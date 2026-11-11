/**
 * Demo dataset: FICTIONAL creators for exploring the product before any data
 * provider is connected. Every row is flagged isDemo / source=DEMO, shown with
 * a "Demo" badge in the UI, and removable in one click (Settings).
 *
 * Generated deterministically so screenshots and tests are reproducible.
 */
import { prisma } from "@/lib/db";
import type { Platform, SignalType } from "@/generated/prisma/enums";
import { refreshRollup } from "./rollup";

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Archetype = {
  niche: string;
  topics: string[];
  bioHooks: string[];
};

const ARCHETYPES: Archetype[] = [
  { niche: "Fitness", topics: ["20-min home workout", "progressive overload explained", "what I eat in a day", "kettlebell basics"], bioHooks: ["Helping busy parents get strong at home", "Former PE teacher. No-gym training."] },
  { niche: "Personal finance", topics: ["paying off $40K debt", "budget with me", "index funds for beginners", "my zero-based budget"], bioHooks: ["Debt-free at 29. Teaching money basics.", "Plain-English money for first-gen earners"] },
  { niche: "Parenting", topics: ["toddler meal ideas", "gentle bedtime routine", "screen-time rules that worked", "Montessori on a budget"], bioHooks: ["Mum of 3 sharing what actually works", "Dad, ex-nurse, honest parenting"] },
  { niche: "Food & cooking", topics: ["5-ingredient dinners", "sourdough troubleshooting", "meal prep Sunday", "one-pan pasta"], bioHooks: ["Weeknight cooking for real kitchens", "Home baker, ex-line cook"] },
  { niche: "Productivity", topics: ["my Notion setup", "deep work routine", "ADHD-friendly planning", "weekly review"], bioHooks: ["Systems for scattered brains", "PhD student sharing study systems"] },
  { niche: "Home & DIY", topics: ["renter-friendly upgrades", "$200 kitchen refresh", "build a floating shelf", "thrift flip"], bioHooks: ["Renovating a 1920s house on a budget", "DIY for renters"] },
  { niche: "Wellness", topics: ["morning mobility", "sleep routine", "walking for anxiety", "habit stacking"], bioHooks: ["Gentle wellness without the hype", "Physio sharing everyday mobility"] },
  { niche: "Tech", topics: ["budget laptop picks", "home lab tour", "learn Python in 30 days", "smart home on a budget"], bioHooks: ["Self-taught dev. Explaining tech simply.", "IT tech sharing practical setups"] },
  { niche: "Education", topics: ["GCSE maths tricks", "how to learn a language fast", "history in 5 minutes", "essay structure"], bioHooks: ["Teacher making revision less painful", "Linguist, 6 languages"] },
  { niche: "Pets", topics: ["puppy training day 1", "raw vs kibble", "cat enrichment DIY", "rescue dog update"], bioHooks: ["Certified trainer, positive methods", "Fostered 40+ rescue cats"] },
  { niche: "Travel", topics: ["Japan on $50/day", "carry-on only packing", "hidden Lisbon", "van life costs"], bioHooks: ["Slow travel on a small budget", "Nurse who travels between contracts"] },
  { niche: "Beauty", topics: ["drugstore dupes", "skincare for acne-prone skin", "5-minute makeup", "curly hair routine"], bioHooks: ["Esthetician, no gatekeeping", "Curly hair, honest reviews"] },
];

const FIRST = ["Mara", "Theo", "Priya", "Jonah", "Lena", "Kofi", "Ines", "Rafi", "Sasha", "Bea", "Omar", "Tova", "Nico", "Ada", "Felix", "Yuki", "Leah", "Dario", "Imani", "Cal", "Rosa", "Ezra", "Juno", "Malik", "Wren", "Ola", "Hugo", "Nell", "Arjun", "Isla", "Remy", "Zara", "Bram", "Lotte", "Sami", "Kit"];
const LAST = ["Quill", "Fairweather", "Okafor", "Lindqvist", "Marsh", "Delacroix", "Haddad", "Brennan", "Castellano", "Nakamura", "Ashby", "Mbeki", "Varga", "Holloway", "Sørensen", "Pereira", "Abara", "Whitlock", "Kaur", "Drummond", "Esposito", "Calloway", "Thorne", "Achebe", "Lund", "Moreau", "Pike", "Rivera", "Oduya", "Stroud", "Beaumont", "Iqbal", "Vos", "Keane", "Halvorsen", "Ferrante"];
const GEO: [string, string][] = [["US", "en"], ["GB", "en"], ["CA", "en"], ["AU", "en"], ["IE", "en"], ["DE", "de"], ["ES", "es"], ["BR", "pt"], ["MX", "es"], ["IN", "en"], ["NL", "nl"], ["PH", "tl"]];

const SPONSOR_LINES = [
  "This video is sponsored by Brightleaf Meals — code {H}20 for 20% off.",
  "#ad Thanks to Nordpeak for partnering on this one.",
  "Use my link for 15% off Lumen Sleep (affiliate).",
  "Paid partnership with Fieldnote Planners.",
];

export async function clearDemoData() {
  // Cascades remove accounts, snapshots, content, signals, scores, prospects.
  const { count } = await prisma.creator.deleteMany({ where: { isDemo: true } });
  return count;
}

export async function seedDemoData(count = 36) {
  await clearDemoData();
  const r = rng(20261111);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)]!;
  const now = Date.now();
  const DAY = 86400_000;

  for (let i = 0; i < count; i++) {
    const arch = ARCHETYPES[i % ARCHETYPES.length]!;
    const first = FIRST[i % FIRST.length]!;
    const last = LAST[(i * 7) % LAST.length]!;
    const name = `${first} ${last}`;
    const [country, language] = pick(GEO);
    const base = `${first}${last}`.toLowerCase().replace(/[^a-z]/g, "");
    const commerciality = r(); // 0 = untouched, 1 = heavily monetised
    const sizeRoll = r();
    const baseFollowers = Math.round(
      sizeRoll < 0.35 ? 2_000 + r() * 8_000 : sizeRoll < 0.75 ? 10_000 + r() * 90_000 : sizeRoll < 0.93 ? 100_000 + r() * 400_000 : 500_000 + r() * 1_500_000,
    );
    const growthPerWeek = -0.004 + r() * 0.03; // -0.4% .. +2.6% per week
    const businessEmail = commerciality > 0.55;
    const bio = `${pick(arch.bioHooks).replace(/\.$/, "")}.${businessEmail ? ` Business: hello@${base}.example` : ""}${commerciality > 0.8 ? " | Managed by Northlight Talent" : ""}`;

    const platformCount = 1 + Math.floor(r() * 3);
    const platforms = (["YOUTUBE", "INSTAGRAM", "TIKTOK"] as Platform[]).sort(() => r() - 0.5).slice(0, platformCount);

    const creator = await prisma.creator.create({
      data: {
        displayName: name,
        primaryNiche: arch.niche,
        niches: [arch.niche],
        country,
        language,
        bio,
        isDemo: true,
        discoveredAt: new Date(now - Math.floor(r() * 45) * DAY),
      },
    });

    const signals: { type: SignalType; evidence: string; contentIdx?: number; accountIdx: number }[] = [];
    if (businessEmail) signals.push({ type: "BUSINESS_CONTACT", evidence: `Bio lists a business email: hello@${base}.example`, accountIdx: 0 });
    if (commerciality > 0.8) signals.push({ type: "TALENT_MANAGEMENT", evidence: "Bio: “Managed by Northlight Talent”", accountIdx: 0 });
    if (commerciality > 0.7) signals.push({ type: "COURSE", evidence: `Link in bio to a paid course: “${arch.niche} Foundations”`, accountIdx: 0 });
    if (commerciality > 0.9) signals.push({ type: "MERCH", evidence: "Merch shelf enabled on channel", accountIdx: 0 });

    for (let a = 0; a < platforms.length; a++) {
      const platform = platforms[a]!;
      const handle = a === 0 ? base : `${base}${platform === "TIKTOK" ? ".tt" : platform === "INSTAGRAM" ? ".ig" : ".yt"}`;
      const share = a === 0 ? 1 : 0.2 + r() * 0.8;
      const followers = Math.round(baseFollowers * share);
      // Smaller accounts typically engage better; add noise.
      const engagement = Math.min(0.18, Math.max(0.004, (0.09 / Math.log10(followers + 10)) * (0.5 + r())));
      const avgViews = Math.round(followers * (platform === "TIKTOK" ? 0.4 + r() * 1.2 : 0.08 + r() * 0.35));
      const lastPostAt = new Date(now - Math.floor(r() * (r() < 0.1 ? 60 : 9)) * DAY);
      const url =
        platform === "YOUTUBE" ? `https://www.youtube.com/@${handle}` : platform === "INSTAGRAM" ? `https://www.instagram.com/${handle}/` : `https://www.tiktok.com/@${handle}`;

      // 13 weekly snapshots ending today, growing towards current follower count.
      const snapshots = Array.from({ length: 13 }, (_, w) => {
        const weeksAgo = 12 - w;
        const f = Math.round(followers / Math.pow(1 + growthPerWeek, weeksAgo) * (0.99 + r() * 0.02));
        return { capturedAt: new Date(now - weeksAgo * 7 * DAY), followers: f, avgViews, engagementRate: engagement, source: "DEMO" as const };
      });
      snapshots[snapshots.length - 1]!.followers = followers;

      const posts = Array.from({ length: 8 }, (_, p) => {
        const sponsored = r() < commerciality * 0.6;
        const topic = pick(arch.topics);
        const text = `${topic[0]!.toUpperCase()}${topic.slice(1)} — full breakdown.${sponsored ? " " + pick(SPONSOR_LINES).replace("{H}", first.toUpperCase()) : ""}`;
        const views = Math.round(avgViews * (0.5 + r()));
        return {
          externalId: `demo-${i}-${a}-${p}`,
          title: topic,
          text,
          url,
          publishedAt: new Date(+lastPostAt - p * (2 + r() * 5) * DAY),
          views,
          likes: Math.round(views * engagement * 0.9),
          comments: Math.round(views * engagement * 0.1),
          source: "DEMO" as const,
          sponsored,
        };
      });

      const account = await prisma.platformAccount.create({
        data: {
          creatorId: creator.id,
          platform,
          handle,
          url,
          followers,
          avgViews,
          engagementRate: engagement,
          postsLast30d: posts.filter((p) => +p.publishedAt > now - 30 * DAY).length,
          lastPostAt,
          source: "DEMO",
          fetchedAt: new Date(now),
          snapshots: { create: snapshots },
        },
      });

      for (const { sponsored, ...p } of posts) {
        const item = await prisma.contentItem.create({ data: { ...p, accountId: account.id } });
        if (sponsored) {
          const line = p.text.split("— full breakdown.")[1]!.trim();
          const type: SignalType = /affiliate|my link/i.test(line) ? "AFFILIATE" : /partner/i.test(line) ? "BRAND_PARTNERSHIP" : "SPONSORSHIP";
          await prisma.commercialSignal.create({
            data: { creatorId: creator.id, contentItemId: item.id, type, evidenceKind: "OBSERVED", evidence: line, sourceUrl: url, source: "DEMO", observedAt: p.publishedAt },
          });
        }
      }
    }

    for (const s of signals) {
      await prisma.commercialSignal.create({
        data: { creatorId: creator.id, type: s.type, evidenceKind: "OBSERVED", evidence: s.evidence, source: "DEMO" },
      });
    }
    await refreshRollup(creator.id);
  }
  return count;
}
