import Link from "next/link";
import type { BudgetGroup, DashboardSummary } from "@finance/types";
import { brl, percent } from "@/lib/format";

type Summary = DashboardSummary;
type Item = Summary["budget"]["items"][number];

// SAVINGS e DEBTS formam "Futuro": ali a barra mede quanto já foi
// guardado/pago (encher é bom); nos demais, quanto do limite já foi gasto.
const SECTIONS: { title: string; hint: string; groups: BudgetGroup[]; kind: "limit" | "target" }[] = [
  { title: "Essenciais", hint: "Contas que não dá para cortar.", groups: ["ESSENTIALS"], kind: "limit" },
  { title: "Futuro", hint: "O que você separa para dívidas e reserva.", groups: ["DEBTS", "SAVINGS"], kind: "target" },
  { title: "Estilo de vida", hint: "Lazer, esporte e o resto.", groups: ["LIFESTYLE"], kind: "limit" },
];

function Meter({ value, max, over }: { value: number; max: number; over: boolean }) {
  const ratio = max > 0 ? Math.min(value / max, 1) : value > 0 ? 1 : 0;
  return (
    <div className="h-2 rounded-full bg-brand-soft" aria-hidden>
      <div
        className={`h-2 rounded-full ${over ? "bg-expense" : "bg-brand"}`}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}

function ItemRow({ item, kind }: { item: Item; kind: "limit" | "target" }) {
  const diff = item.planned - item.spent;
  const over = kind === "limit" && diff < 0;

  let status: React.ReactNode;
  if (kind === "limit") {
    status = over ? (
      <span className="font-semibold text-expense">Passou {brl(-diff)}</span>
    ) : (
      <span>Restam {brl(diff)}</span>
    );
  } else {
    status = diff <= 0 ? <span className="font-semibold text-brand">Meta do mês cumprida</span> : <span>Faltam {brl(diff)}</span>;
  }

  return (
    <li className="grid gap-1.5 py-3 sm:grid-cols-[10rem_1fr_11rem] sm:items-center sm:gap-4">
      <div className="flex items-baseline justify-between gap-2 sm:block">
        <p className="font-semibold">{item.name}</p>
        <p className="text-xs text-muted">{percent(item.percent)} da renda</p>
      </div>
      <Meter value={item.spent} max={item.planned} over={over} />
      <div className="flex justify-between gap-2 text-sm tabular-nums sm:block sm:text-right">
        <p className="text-muted">
          {brl(item.spent)} de {brl(item.planned)}
        </p>
        <p className="text-muted">{status}</p>
      </div>
    </li>
  );
}

export function PlanProgress({ summary }: { summary: Summary }) {
  const { budget, debtPayoff } = summary;

  if (budget.monthlyIncome === null) {
    return (
      <div className="rounded-lg border border-dashed border-brand/40 bg-white p-6">
        <h2 className="text-lg font-bold">Seu plano do mês</h2>
        <p className="mt-1 max-w-prose text-muted">
          Informe sua renda fixa e veja quanto pode gastar em cada categoria. Já deixamos uma divisão sugerida
          pronta para você ajustar.
        </p>
        <Link
          href="/plano"
          className="mt-4 inline-block rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Definir minha renda
        </Link>
      </div>
    );
  }

  const plannedSpent = budget.items.reduce((sum, item) => sum + item.spent, 0);
  const outsidePlan = Math.round((summary.totals.expense - plannedSpent) * 100) / 100;

  return (
    <section aria-labelledby="plan-title" className="rounded-lg bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="plan-title" className="text-lg font-bold">
          Seu plano do mês
        </h2>
        <p className="text-sm text-muted">
          Base: renda de {brl(budget.monthlyIncome)}.{" "}
          <Link href="/plano" className="font-semibold text-brand hover:underline">
            Ajustar plano
          </Link>
        </p>
      </div>

      {SECTIONS.map((section) => {
        const items = budget.items.filter((item) => section.groups.includes(item.group));
        if (items.length === 0) return null;
        return (
          <div key={section.title} className="mt-5">
            <h3 className="font-semibold">{section.title}</h3>
            <p className="text-sm text-muted">{section.hint}</p>
            <ul className="divide-y divide-line">
              {items.map((item) => (
                <ItemRow key={item.categoryId} item={item} kind={section.kind} />
              ))}
            </ul>
            {section.title === "Futuro" && debtPayoff && (
              <p className="mt-1 rounded-md bg-brand-soft px-3 py-2 text-sm">
                {debtPayoff.possible && debtPayoff.debtFreeDate ? (
                  <>
                    Mantendo {brl(debtPayoff.monthlyPayment)} por mês nas dívidas, você quita todas em{" "}
                    <strong>
                      {new Date(debtPayoff.debtFreeDate).toLocaleDateString("pt-BR", {
                        month: "long",
                        year: "numeric",
                      })}
                    </strong>
                    .
                  </>
                ) : (
                  <>
                    Com {brl(debtPayoff.monthlyPayment)} por mês os juros crescem mais rápido que os pagamentos.
                    Aumente a parte de dívidas no plano.
                  </>
                )}
              </p>
            )}
          </div>
        );
      })}

      {outsidePlan > 0 && (
        <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
          Gastos em categorias fora do plano: <span className="font-semibold text-ink">{brl(outsidePlan)}</span>
        </p>
      )}
    </section>
  );
}
