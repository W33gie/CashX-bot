import { describe, it, expect } from "vitest";
import { computeRollup, computeGrowth30d } from "./metrics";
import { parseFilters, toQuery, hasActiveFilters } from "./filters";
import { csvCell, toCsv } from "./csv";
import { dataCompleteness } from "./completeness";

const DAY = 86400_000;

describe("computeRollup", () => {
  it("keeps unknown as null, never zero", () => {
    const r = computeRollup([{ platform: "YOUTUBE", followers: null, engagementRate: null, lastPostAt: null }]);
    expect(r.totalFollowers).toBeNull();
    expect(r.engagementRate).toBeNull();
  });
  it("sums followers and follower-weights engagement", () => {
    const r = computeRollup([
      { platform: "YOUTUBE", followers: 9000, engagementRate: 0.02, lastPostAt: new Date(1) },
      { platform: "TIKTOK", followers: 1000, engagementRate: 0.12, lastPostAt: new Date(5) },
      { platform: "INSTAGRAM", followers: 500, engagementRate: null, lastPostAt: null },
    ]);
    expect(r.totalFollowers).toBe(10500);
    expect(r.engagementRate).toBeCloseTo((9000 * 0.02 + 1000 * 0.12) / 10000);
    expect(r.lastPostAt).toEqual(new Date(5));
    expect(r.platforms).toEqual(["YOUTUBE", "TIKTOK", "INSTAGRAM"]);
  });
});

describe("computeGrowth30d", () => {
  const now = Date.now();
  it("returns null without enough history", () => {
    expect(computeGrowth30d([])).toBeNull();
    expect(computeGrowth30d([{ capturedAt: new Date(now - 5 * DAY), followers: 100 }, { capturedAt: new Date(now), followers: 120 }])).toBeNull();
  });
  it("measures growth against the snapshot closest to 30 days back", () => {
    const g = computeGrowth30d([
      { capturedAt: new Date(now - 60 * DAY), followers: 500 },
      { capturedAt: new Date(now - 29 * DAY), followers: 1000 },
      { capturedAt: new Date(now - 10 * DAY), followers: 1100 },
      { capturedAt: new Date(now), followers: 1200 },
    ]);
    expect(g).toBeCloseTo(0.2);
  });
  it("ignores snapshots with unknown followers", () => {
    expect(computeGrowth30d([{ capturedAt: new Date(now - 30 * DAY), followers: null }, { capturedAt: new Date(now), followers: 10 }])).toBeNull();
  });
});

describe("filters", () => {
  it("parses valid params and drops junk", () => {
    const f = parseFilters({ q: " fit ", minFollowers: "5000", minEngagement: "3.5", platform: "NOPE", sort: "followers", page: "x" });
    expect(f.q).toBe("fit");
    expect(f.minFollowers).toBe(5000);
    expect(f.minEngagement).toBe(3.5);
    expect(f.platform).toBeUndefined();
    expect(f.sort).toBe("followers");
    expect(f.page).toBeUndefined();
    expect(hasActiveFilters(f)).toBe(true);
    expect(hasActiveFilters(parseFilters({ sort: "name" }))).toBe(false);
  });
  it("builds query strings with overrides", () => {
    expect(toQuery({ q: "a", page: 2 }, { page: undefined, sort: "name" })).toBe("?q=a&sort=name");
    expect(toQuery({})).toBe("");
  });
});

describe("csv", () => {
  it("escapes quotes, commas and newlines", () => {
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    expect(csvCell(null)).toBe("");
  });
  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-1")).toBe("'-1");
  });
  it("joins rows with CRLF", () => {
    expect(toCsv(["a", "b"], [[1, 2]])).toBe("a,b\r\n1,2\r\n");
  });
});

describe("dataCompleteness", () => {
  it("is 0 for an empty profile and 1 for a complete one", () => {
    expect(dataCompleteness({ bio: null, primaryNiche: null, accounts: [], contentCount: 0 }).score).toBe(0);
    const now = Date.now();
    const full = dataCompleteness({
      bio: "x",
      primaryNiche: "Fitness",
      contentCount: 8,
      accounts: [
        {
          followers: 10,
          engagementRate: 0.1,
          postsLast30d: 4,
          lastPostAt: new Date(),
          snapshots: [{ capturedAt: new Date(now - 30 * DAY), followers: 9 }, { capturedAt: new Date(now), followers: 10 }],
        },
      ],
    });
    expect(full.score).toBe(1);
  });
});
