"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";

type Row = { niche: string; count: number; avgOpportunity: number | null };

export function NicheChart({ data }: { data: Row[] }) {
  const scored = data.some((d) => d.avgOpportunity != null);
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }} barCategoryGap={6}>
          <XAxis type="number" dataKey="count" domain={[0, "dataMax"]} hide />
          <YAxis
            type="category"
            dataKey="niche"
            width={118}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--ink)",
            }}
            formatter={(v, _n, item) => {
              const p = (item as { payload: Row }).payload;
              return [
                `${v} creators${scored ? ` · avg opportunity ${p.avgOpportunity ?? "n/a"}` : ""}`,
                p.niche,
              ];
            }}
            labelFormatter={() => ""}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={d.niche} fill={i === 0 ? "var(--chart-1)" : "var(--chart-2)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
