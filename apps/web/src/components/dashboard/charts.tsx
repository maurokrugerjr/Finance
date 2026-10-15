"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardSummary } from "@finance/types";
import { brl, compact } from "@/lib/format";
import { monthLabel } from "@/lib/month";

// Par validado com o validate_palette.js da skill dataviz (CVD ΔE 8.8). O âmbar
// fica abaixo de 3:1 de contraste, por isso há legenda + tabela, nunca só cor.
const SERIES = [
  { key: "income", label: "Entrou", color: "#2F8F6B" },
  { key: "expense", label: "Saiu", color: "#C98A2E" },
] as const;

const MAX_CATEGORIES = 6;

// Uma série só: todas as barras na mesma cor, valor na ponta, sem legenda.
export function SpendingByCategory({ items, total }: { items: DashboardSummary["expensesByCategory"]; total: number }) {
  const shown = items.slice(0, MAX_CATEGORIES);
  const rest = items.slice(MAX_CATEGORIES).reduce((sum, item) => sum + item.total, 0);
  const rows = rest > 0 ? [...shown.map((i) => ({ name: i.name, total: i.total })), { name: "Demais categorias", total: rest }] : shown;
  const max = Math.max(...rows.map((row) => row.total), 0);

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.name} className="grid grid-cols-[minmax(6rem,9rem)_1fr] items-center gap-3 text-sm">
          <span className="truncate" title={row.name}>
            {row.name}
          </span>
          <div className="flex items-center gap-2">
            <div className="h-3 flex-1">
              <div
                className="h-3 rounded-r bg-brand"
                style={{ width: `${max > 0 ? Math.max((row.total / max) * 100, 1) : 0}%` }}
              />
            </div>
            <span className="w-28 shrink-0 text-right tabular-nums">
              {brl(row.total)}
              <span className="ml-1 text-xs text-muted">{total > 0 ? Math.round((row.total / total) * 100) : 0}%</span>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-white px-3 py-2 text-sm shadow-sm">
      <p className="font-semibold">{label}</p>
      {SERIES.map((series) => {
        const value = payload.find((p) => p.dataKey === series.key)?.value ?? 0;
        return (
          <p key={series.key} className="flex items-center gap-2 tabular-nums">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: series.color }} />
            {series.label}: {brl(value)}
          </p>
        );
      })}
    </div>
  );
}

export function MonthlyHistory({ monthly }: { monthly: DashboardSummary["monthly"] }) {
  const [asTable, setAsTable] = useState(false);
  const data = monthly.map((row) => ({ ...row, label: monthLabel(row.month, "short") }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ul className="flex gap-4 text-sm" aria-label="Legenda">
          {SERIES.map((series) => (
            <li key={series.key} className="flex items-center gap-2">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: series.color }} />
              {series.label}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          className="rounded px-2 py-1 text-sm font-semibold text-brand hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
        >
          {asTable ? "Ver gráfico" : "Ver em tabela"}
        </button>
      </div>

      {asTable ? (
        <table className="mt-4 w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-2 font-semibold">Mês</th>
              <th className="py-2 text-right font-semibold">Entrou</th>
              <th className="py-2 text-right font-semibold">Saiu</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((row) => (
              <tr key={row.month} className="border-b border-line last:border-0">
                <td className="py-2">{monthLabel(row.month)}</td>
                <td className="py-2 text-right">{brl(row.income)}</td>
                <td className="py-2 text-right">{brl(row.expense)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="mt-4 h-56" role="img" aria-label="Gráfico de entradas e saídas dos últimos meses; use Ver em tabela para os valores">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="#E3E9E6" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#5A6965", fontSize: 12 }} />
              <YAxis
                width={44}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#5A6965", fontSize: 12 }}
                tickFormatter={(value: number) => compact(value)}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "#E4EEE8", opacity: 0.6 }} />
              {SERIES.map((series) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  name={series.label}
                  fill={series.color}
                  maxBarSize={24}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
