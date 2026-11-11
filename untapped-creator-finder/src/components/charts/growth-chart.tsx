"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

type Point = { t: number; followers: number };

const fmt = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export function GrowthChart({ series }: { series: { label: string; points: Point[] }[] }) {
  // Merge series onto a shared time axis.
  const byT = new Map<number, Record<string, number>>();
  for (const s of series) for (const p of s.points) byT.set(p.t, { ...(byT.get(p.t) ?? { t: p.t }), [s.label]: p.followers });
  const data = [...byT.values()].sort((a, b) => a.t! - b.t!);
  const colors = ["var(--chart-1)", "var(--info)", "var(--warn)"];
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t) => new Date(t).toLocaleDateString("en", { month: "short", day: "numeric" })}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis tickFormatter={(v) => fmt.format(v)} tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            labelFormatter={(t) => new Date(Number(t)).toLocaleDateString("en", { dateStyle: "medium" })}
            formatter={(v) => fmt.format(Number(v))}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, color: "var(--ink)" }}
          />
          {series.map((s, i) => (
            <Line key={s.label} dataKey={s.label} stroke={colors[i % colors.length]} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
