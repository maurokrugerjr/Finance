"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Budget, BudgetGroup, BudgetUpdateInput, Category } from "@finance/types";
import { Alert, Button, Field } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { brl, moneyInput, parseMoney, percent as formatPercent } from "@/lib/format";
import { useBudget, useCategories } from "@/lib/queries";
import { CategoryActions, NewCategoryForm, useInvalidatePlan } from "./category-controls";

type GroupChoice = BudgetGroup | "NONE";
type Row = { categoryId: string; name: string; group: GroupChoice; percent: string };

const GROUP_OPTIONS: { value: GroupChoice; label: string }[] = [
  { value: "ESSENTIALS", label: "Essenciais" },
  { value: "DEBTS", label: "Futuro: dívidas" },
  { value: "SAVINGS", label: "Futuro: reserva" },
  { value: "LIFESTYLE", label: "Estilo de vida" },
  { value: "NONE", label: "Fora do plano" },
];

// Faixas de referência mostradas como guia (não são obrigatórias).
const GUIDE: { title: string; groups: BudgetGroup[]; suggestion: string; description: string }[] = [
  { title: "Essenciais", groups: ["ESSENTIALS"], suggestion: "cerca de 50%", description: "Moradia, mercado, transporte, saúde." },
  { title: "Futuro", groups: ["DEBTS", "SAVINGS"], suggestion: "cerca de 25%", description: "Quitar dívidas e montar a reserva." },
  { title: "Estilo de vida", groups: ["LIFESTYLE"], suggestion: "cerca de 25%", description: "Lazer, esporte e o resto." },
];

const GROUP_ORDER: GroupChoice[] = ["ESSENTIALS", "DEBTS", "SAVINGS", "LIFESTYLE", "NONE"];

const parsePercent = (value: string) => {
  const parsed = Number(value.replace(",", "."));
  return value.trim() === "" ? 0 : Number.isFinite(parsed) ? parsed : NaN;
};

function toRow(category: Category): Row {
  return {
    categoryId: category.id,
    name: category.name,
    group: (category.budgetGroup ?? "NONE") as GroupChoice,
    percent: category.budgetPercent != null ? String(category.budgetPercent).replace(".", ",") : "",
  };
}

function sortRows(rows: Row[]) {
  return [...rows].sort(
    (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.name.localeCompare(b.name, "pt-BR"),
  );
}

export function PlanEditor() {
  const budget = useBudget();
  const categories = useCategories();

  if (budget.isPending || categories.isPending) {
    return <div className="h-96 animate-pulse rounded-lg bg-white" aria-label="Carregando plano" />;
  }
  if (budget.isError || categories.isError) {
    return <Alert>{errorMessage(budget.error ?? categories.error)}</Alert>;
  }
  return <PlanForm budget={budget.data} categories={categories.data} />;
}

function SuggestedCategories() {
  const invalidate = useInvalidatePlan();
  const mutation = useMutation({
    mutationFn: () => apiFetch("/categories/defaults", { method: "POST" }),
    onSuccess: invalidate,
  });
  return (
    <section className="rounded-lg border border-dashed border-brand/40 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-bold">Comece pelas categorias sugeridas</h2>
      <p className="mt-1 max-w-prose text-muted">
        Você ainda não tem categorias. Podemos criar uma lista pronta (Moradia e contas, Mercado, Gasolina, Saúde,
        Quitação de dívidas, Reserva de emergência, Esporte, Lazer e bobagens, Outros e Salário) já com uma divisão
        sugerida da renda. Depois é só ajustar.
      </p>
      {mutation.isError && (
        <div className="mt-3">
          <Alert>{errorMessage(mutation.error)}</Alert>
        </div>
      )}
      <Button className="mt-4" onClick={() => mutation.mutate()} loading={mutation.isPending} loadingText="Criando...">
        Usar as categorias sugeridas
      </Button>
    </section>
  );
}

function PlanForm({ budget, categories }: { budget: Budget; categories: Category[] }) {
  const invalidate = useInvalidatePlan();
  const [income, setIncome] = useState(moneyInput(budget.monthlyIncome));
  const [rows, setRows] = useState<Row[]>(() => sortRows(categories.filter((c) => c.kind === "EXPENSE").map(toRow)));
  const [incomeError, setIncomeError] = useState<string>();
  const [saved, setSaved] = useState(false);

  // Categorias criadas/renomeadas/apagadas valem na hora; aqui elas entram nas
  // linhas sem descartar porcentagens que a pessoa ainda não salvou.
  useEffect(() => {
    setRows((current) => {
      const expense = categories.filter((c) => c.kind === "EXPENSE");
      const fresh = new Map(expense.map((c) => [c.id, c]));
      const known = new Set(current.map((row) => row.categoryId));
      // Mantém a ordem atual (a API devolve em ordem alfabética, o que
      // embaralharia os grupos) e acrescenta as novas no fim.
      const kept = current
        .filter((row) => fresh.has(row.categoryId))
        .map((row) => ({ ...row, name: fresh.get(row.categoryId)!.name }));
      const added = expense.filter((c) => !known.has(c.id)).map(toRow);
      return current.length === 0 ? sortRows(added) : [...kept, ...sortRows(added)];
    });
  }, [categories]);

  const incomeValue = parseMoney(income);
  const planned = rows.filter((row) => row.group !== "NONE");
  const invalidRow = planned.find((row) => {
    const value = parsePercent(row.percent);
    return Number.isNaN(value) || value < 0 || value > 100;
  });
  // Soma em centésimos para não acumular erro de ponto flutuante.
  const sumPercent = (list: Row[]) =>
    list.reduce((sum, row) => sum + Math.round((parsePercent(row.percent) || 0) * 100), 0) / 100;
  const totalPercent = sumPercent(planned);
  const overBy = Math.round((totalPercent - 100) * 100) / 100;
  const remaining = Math.round((100 - totalPercent) * 100) / 100;

  const groupTotals = useMemo(
    () => GUIDE.map((guide) => ({ ...guide, percent: sumPercent(rows.filter((row) => (guide.groups as GroupChoice[]).includes(row.group))) })),
    [rows],
  );

  const amountOf = (pct: number) => (incomeValue ? Math.round(incomeValue * pct) / 100 : null);
  const incomeCategories = categories
    .filter((c) => c.kind === "INCOME")
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const mutation = useMutation({
    mutationFn: (input: BudgetUpdateInput) => apiFetch<Budget>("/budget", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: async () => {
      setSaved(true);
      await invalidate();
    },
  });

  // "Plano salvo" some só quando a pessoa edita algo (não quando a lista de
  // categorias é recarregada depois de salvar).
  function update(categoryId: string, patch: Partial<Row>) {
    setSaved(false);
    setRows((current) => current.map((row) => (row.categoryId === categoryId ? { ...row, ...patch } : row)));
  }

  function handleSave() {
    if (!incomeValue || incomeValue <= 0) {
      setIncomeError("Digite sua renda mensal, por exemplo 5.000,00.");
      document.getElementById("income")?.focus();
      return;
    }
    if (invalidRow || overBy > 0) return;
    mutation.mutate({
      monthlyIncome: incomeValue,
      items: planned
        .filter((row) => parsePercent(row.percent) > 0)
        .map((row) => ({ categoryId: row.categoryId, group: row.group as BudgetGroup, percent: parsePercent(row.percent) })),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Meu plano</h1>
        <p className="mt-1 max-w-prose text-muted">
          Aqui ficam suas configurações: a renda fixa, as categorias e quanto da renda vai para cada uma. O painel
          compara, todo mês, o que você planejou com o que realmente gastou.
        </p>
      </div>

      {categories.length === 0 && <SuggestedCategories />}

      {/* Renda + divisão são salvas juntas pelo botão "Salvar plano"; criar,
          renomear e apagar categorias vale na hora (por isso não é um <form>
          único: cada categoria nova tem o seu). */}
      <div className="flex flex-col gap-6">
        <section aria-labelledby="income-title" className="rounded-lg bg-white p-5 sm:p-6">
          <h2 id="income-title" className="text-lg font-bold">
            1. Renda mensal fixa
          </h2>
          <div className="mt-3 max-w-xs">
            <Field
              id="income"
              name="income"
              label="Valor (R$)"
              inputMode="decimal"
              placeholder="5.000,00"
              hint="Seu salário ou o que entra todo mês. É a base das porcentagens."
              value={income}
              onChange={(e) => {
                setIncome(e.target.value);
                setIncomeError(undefined);
                setSaved(false);
              }}
              onBlur={() => incomeValue && setIncome(moneyInput(incomeValue))}
              error={incomeError}
            />
          </div>
        </section>

        <section aria-labelledby="split-title" className="rounded-lg bg-white p-5 sm:p-6">
          <h2 id="split-title" className="text-lg font-bold">
            2. Gastos: categorias e divisão
          </h2>
          <p className="mt-1 max-w-prose text-sm text-muted">
            Para cada categoria, escolha o grupo e quanto da renda vai para ela. Em &ldquo;Fora do plano&rdquo; a
            categoria não tem limite. As faixas abaixo são uma referência para começar.
          </p>

          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {groupTotals.map((group) => (
              <li key={group.title} className="rounded-md border border-line p-3">
                <p className="font-semibold">{group.title}</p>
                <p className="text-sm text-muted">{group.description}</p>
                <p className="mt-2 text-sm tabular-nums">
                  <span className="font-semibold">{formatPercent(group.percent)}</span>
                  {amountOf(group.percent) !== null && <span className="text-muted"> ({brl(amountOf(group.percent)!)})</span>}
                </p>
                <p className="text-xs text-muted">Sugestão: {group.suggestion}</p>
              </li>
            ))}
          </ul>

          <div className="mt-6 hidden grid-cols-[1fr_11rem_6rem_7rem_9rem] gap-3 border-b border-line pb-2 text-sm font-semibold text-muted md:grid">
            <span>Categoria</span>
            <span>Grupo</span>
            <span>% da renda</span>
            <span className="text-right">Por mês</span>
            <span className="sr-only">Ações</span>
          </div>
          {rows.length === 0 && <p className="mt-4 text-muted">Nenhuma categoria de gasto ainda. Crie a primeira abaixo.</p>}
          <ul className="divide-y divide-line">
            {rows.map((row) => {
              const value = parsePercent(row.percent);
              const rowInvalid = row.group !== "NONE" && (Number.isNaN(value) || value < 0 || value > 100);
              const amount = row.group !== "NONE" && !rowInvalid ? amountOf(value || 0) : null;
              return (
                <li key={row.categoryId} className="grid grid-cols-2 items-center gap-3 py-3 md:grid-cols-[1fr_11rem_6rem_7rem_9rem]">
                  <span className="col-span-2 font-semibold md:col-span-1">{row.name}</span>
                  <select
                    aria-label={`Grupo de ${row.name}`}
                    value={row.group}
                    onChange={(e) => update(row.categoryId, { group: e.target.value as GroupChoice })}
                    className="rounded-md border border-line bg-white px-2 py-2 text-sm focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20"
                  >
                    {GROUP_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <input
                      aria-label={`Porcentagem de ${row.name}`}
                      aria-invalid={rowInvalid}
                      inputMode="decimal"
                      disabled={row.group === "NONE"}
                      value={row.group === "NONE" ? "" : row.percent}
                      placeholder={row.group === "NONE" ? "–" : "0"}
                      onChange={(e) => update(row.categoryId, { percent: e.target.value })}
                      className={`w-16 rounded-md border bg-white px-2 py-2 text-right text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 disabled:bg-paper ${
                        rowInvalid ? "border-expense focus-visible:ring-expense/25" : "border-line focus-visible:border-brand focus-visible:ring-brand/20"
                      }`}
                    />
                    <span className="text-sm text-muted">%</span>
                  </div>
                  <span className="text-sm tabular-nums text-muted md:text-right">
                    {rowInvalid ? <span className="text-expense">Use de 0 a 100</span> : amount !== null ? brl(amount) : ""}
                  </span>
                  <CategoryActions id={row.categoryId} name={row.name} kind="EXPENSE" />
                </li>
              );
            })}
          </ul>
          <NewCategoryForm kind="EXPENSE" />
        </section>
      </div>

      <section aria-labelledby="income-categories-title" className="rounded-lg bg-white p-5 sm:p-6">
        <h2 id="income-categories-title" className="text-lg font-bold">
          3. Receitas: categorias
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Usadas ao lançar o que entrou (salário, freela, reembolso). Elas não entram na divisão do plano.
        </p>
        {incomeCategories.length === 0 ? (
          <p className="mt-4 text-muted">Nenhuma categoria de receita ainda.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {incomeCategories.map((category) => (
              <li key={category.id} className="flex items-center justify-between gap-3 py-3">
                <span className="font-semibold">{category.name}</span>
                <CategoryActions id={category.id} name={category.name} kind="INCOME" />
              </li>
            ))}
          </ul>
        )}
        <NewCategoryForm kind="INCOME" />
      </section>

      {/* Barra de resumo: total planejado e o que falta para 100%. */}
      <div className="sticky bottom-0 -mx-4 border-t border-line bg-paper/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:bg-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm tabular-nums" aria-live="polite">
              <span className="font-semibold">{formatPercent(totalPercent)} da renda planejada</span>
              {overBy > 0 ? (
                <span className="font-semibold text-expense"> (passou {formatPercent(overBy)}; reduza alguma categoria)</span>
              ) : remaining > 0 ? (
                <span className="text-muted">
                  {" "}
                  ({formatPercent(remaining)} sem destino{amountOf(remaining) !== null ? `, ${brl(amountOf(remaining)!)}` : ""})
                </span>
              ) : (
                <span className="text-muted"> (toda a renda tem destino)</span>
              )}
            </p>
            <div className="mt-2 h-2 max-w-md rounded-full bg-brand-soft" aria-hidden>
              <div
                className={`h-2 rounded-full ${overBy > 0 ? "bg-expense" : "bg-brand"}`}
                style={{ width: `${Math.min(totalPercent, 100)}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {saved && !mutation.isPending && (
              <p className="text-sm font-semibold text-brand" role="status">
                Plano salvo
              </p>
            )}
            <Button
              onClick={handleSave}
              loading={mutation.isPending}
              loadingText="Salvando..."
              disabled={overBy > 0 || Boolean(invalidRow)}
            >
              Salvar plano
            </Button>
          </div>
        </div>
        {mutation.isError && (
          <div className="mt-3">
            <Alert>{errorMessage(mutation.error)}</Alert>
          </div>
        )}
      </div>
    </div>
  );
}
