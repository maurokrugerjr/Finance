"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { brl, shortDate } from "@/lib/format";
import { currentMonth, isMonthKey, monthLabel, shiftMonth, type MonthKey } from "@/lib/month";
import { useMonthTransactions, useSummary } from "@/lib/queries";
import { errorMessage } from "@/lib/errors";
import { Alert } from "@/components/ui";
import { MonthlyHistory, SpendingByCategory } from "./charts";
import { PlanProgress } from "./plan-progress";

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MonthNav({ month, onChange }: { month: MonthKey; onChange: (month: MonthKey) => void }) {
  const isCurrent = month === currentMonth();
  const arrow =
    "flex h-9 w-9 items-center justify-center rounded-md text-lg text-muted hover:bg-brand-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30";
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={arrow} onClick={() => onChange(shiftMonth(month, -1))} aria-label="Mês anterior">
        ‹
      </button>
      <h1 className="min-w-[11rem] text-center text-xl font-bold" aria-live="polite">
        {monthLabel(month)}
      </h1>
      <button type="button" className={arrow} onClick={() => onChange(shiftMonth(month, 1))} aria-label="Próximo mês">
        ›
      </button>
      {!isCurrent && (
        <button
          type="button"
          onClick={() => onChange(currentMonth())}
          className="ml-2 rounded px-2 py-1 text-sm font-semibold text-brand hover:bg-brand-soft"
        >
          Voltar para o mês atual
        </button>
      )}
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const param = params.get("mes");
  const month = isMonthKey(param) ? param : currentMonth();

  const summary = useSummary(month);
  const transactions = useMonthTransactions(month);

  const setMonth = (next: MonthKey) =>
    router.replace(next === currentMonth() ? "/" : `/?mes=${next}`, { scroll: false });

  const firstName = user?.name.split(" ")[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted">Olá, {firstName}. Este é o resumo de</p>
          <MonthNav month={month} onChange={setMonth} />
        </div>
      </div>

      {summary.isError && <Alert>{errorMessage(summary.error)}</Alert>}

      {summary.isPending ? (
        <div className="h-64 animate-pulse rounded-lg bg-white" aria-label="Carregando resumo" />
      ) : summary.data ? (
        <>
          <Totals income={summary.data.totals.income} expense={summary.data.totals.expense} />
          <PlanProgress summary={summary.data} />

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Para onde foi o dinheiro">
              {summary.data.expensesByCategory.length > 0 ? (
                <SpendingByCategory items={summary.data.expensesByCategory} total={summary.data.totals.expense} />
              ) : (
                <p className="text-muted">Nenhum gasto lançado em {monthLabel(month).toLowerCase()}.</p>
              )}
            </Panel>
            <Panel title="Últimos 6 meses">
              <MonthlyHistory monthly={summary.data.monthly} />
            </Panel>
          </div>
        </>
      ) : null}

      <Panel
        title="Lançamentos do mês"
        action={
          <Link href="/lancar" className="text-sm font-semibold text-brand hover:underline">
            Lançar
          </Link>
        }
      >
        {transactions.isPending ? (
          <p className="text-muted">Carregando...</p>
        ) : transactions.data && transactions.data.length > 0 ? (
          <ul className="divide-y divide-line">
            {transactions.data.slice(0, 8).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{t.description}</p>
                  <p className="text-sm text-muted">
                    {shortDate(t.date)}, {t.category.name}
                    {t.paymentMethod ? `, ${t.paymentMethod === "CREDIT" ? "crédito" : "débito"}` : ""}
                  </p>
                </div>
                <p className={`shrink-0 font-semibold tabular-nums ${t.type === "EXPENSE" ? "text-expense" : "text-brand"}`}>
                  {t.type === "EXPENSE" ? "− " : "+ "}
                  {brl(t.amount)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-2">
            <p className="text-muted">Nenhum lançamento em {monthLabel(month).toLowerCase()} ainda.</p>
            <p className="mt-1 text-muted">Lance seus gastos e receitas para ver o resumo e o plano preenchidos.</p>
            <Link
              href="/lancar"
              className="mt-4 inline-block rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Lançar o primeiro gasto
            </Link>
          </div>
        )}
      </Panel>
    </div>
  );
}

// "Sobrou" é o número principal (hero); entrou/saiu são o contexto.
function Totals({ income, expense }: { income: number; expense: number }) {
  const balance = Math.round((income - expense) * 100) / 100;
  const negative = balance < 0;
  const spentShare = income > 0 ? Math.round((expense / income) * 100) : null;

  return (
    <section aria-label="Totais do mês" className="grid gap-6 rounded-lg bg-white p-5 sm:grid-cols-[1.4fr_1fr_1fr] sm:items-end sm:p-6">
      <div>
        <p className="text-sm font-semibold text-muted">{negative ? "Faltou" : "Sobrou"}</p>
        <p className={`text-5xl font-bold tracking-tight ${negative ? "text-expense" : "text-ink"}`}>
          {brl(Math.abs(balance))}
        </p>
        <p className="mt-1 text-sm text-muted">
          {negative ? "Você gastou mais do que entrou neste mês." : "É o que entrou menos o que saiu."}
        </p>
      </div>
      <div>
        <p className="text-sm font-semibold text-muted">Entrou</p>
        <p className="text-2xl font-bold">{brl(income)}</p>
      </div>
      <div>
        <p className="text-sm font-semibold text-muted">Saiu</p>
        <p className="text-2xl font-bold">{brl(expense)}</p>
        {spentShare !== null && <p className="text-sm text-muted">{spentShare}% do que entrou</p>}
      </div>
    </section>
  );
}
