"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CategoryKind, PaymentMethod, TransactionCreateInput } from "@finance/types";
import { Alert, Button, Field } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { parseMoney } from "@/lib/format";
import { currentMonth, monthOf } from "@/lib/month";
import { useCategories } from "@/lib/queries";
import { focusFirstError } from "@/lib/form";

const FIELDS = ["amount", "description", "categoryId", "date"] as const;
type FieldName = (typeof FIELDS)[number];
// A data vai como "YYYY-MM-DD" (a API interpreta como meia-noite UTC).
type NewTransaction = Omit<TransactionCreateInput, "date"> & { date: string };
type Errors = Partial<Record<FieldName, string>>;

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function Segmented<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-semibold">{legend}</legend>
      <div className="inline-flex w-fit rounded-md border border-line bg-white p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className={`cursor-pointer rounded px-3 py-1.5 text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/30 ${
              value === option.value ? "bg-brand text-white" : "text-muted hover:text-ink"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function TransactionForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const categories = useCategories();

  const [type, setType] = useState<CategoryKind>("EXPENSE");
  const [payment, setPayment] = useState<PaymentMethod | "NONE">("NONE");
  const [form, setForm] = useState<Record<FieldName, string>>({ amount: "", description: "", categoryId: "", date: today() });
  const [errors, setErrors] = useState<Errors>({});

  const options = (categories.data ?? [])
    .filter((c) => c.kind === type)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const mutation = useMutation({
    mutationFn: (input: NewTransaction) =>
      apiFetch("/transactions", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: async (_data, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["summary"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      ]);
      const month = monthOf(input.date);
      router.push(month === currentMonth() ? "/" : `/?mes=${month}`);
    },
  });

  function update(name: FieldName, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  function changeType(next: CategoryKind) {
    setType(next);
    // A categoria escolhida pertence ao outro tipo; limpa para não lançar errado.
    update("categoryId", "");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const amount = parseMoney(form.amount);
    const nextErrors: Errors = {
      amount: !amount || amount <= 0 ? "Digite um valor maior que zero, como 49,90." : undefined,
      description: form.description.trim() ? undefined : "Descreva o lançamento, como Mercado ou Uber.",
      categoryId: form.categoryId ? undefined : "Escolha uma categoria.",
      date: /^\d{4}-\d{2}-\d{2}$/.test(form.date) ? undefined : "Escolha a data.",
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      focusFirstError(FIELDS, nextErrors);
      return;
    }

    mutation.mutate({
      type,
      amount: amount!,
      description: form.description.trim(),
      categoryId: form.categoryId,
      // Só a data (meia-noite UTC): o mês do lançamento não muda com o fuso.
      date: form.date,
      paymentMethod: type === "EXPENSE" && payment !== "NONE" ? payment : null,
    });
  }

  const isExpense = type === "EXPENSE";

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto flex max-w-lg flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">Lançar {isExpense ? "gasto" : "receita"}</h1>
        <p className="mt-1 text-muted">
          {isExpense
            ? "Registre o que saiu. Ele entra no resumo do mês e no seu plano."
            : "Registre o que entrou, como salário ou um freela."}
        </p>
      </div>

      {mutation.isError && <Alert>{errorMessage(mutation.error)}</Alert>}
      {categories.isError && <Alert>{errorMessage(categories.error)}</Alert>}

      <Segmented
        legend="Tipo"
        name="type"
        value={type}
        onChange={changeType}
        options={[
          { value: "EXPENSE", label: "Gasto" },
          { value: "INCOME", label: "Receita" },
        ]}
      />

      <div className="grid gap-5 sm:grid-cols-[1fr_11rem]">
        <Field
          label="Valor (R$)"
          name="amount"
          inputMode="decimal"
          placeholder="0,00"
          autoFocus
          value={form.amount}
          onChange={(e) => update("amount", e.target.value)}
          error={errors.amount}
        />
        <Field
          label="Data"
          name="date"
          type="date"
          value={form.date}
          onChange={(e) => update("date", e.target.value)}
          error={errors.date}
        />
      </div>

      <Field
        label="Descrição"
        name="description"
        placeholder={isExpense ? "Ex.: Mercado do mês" : "Ex.: Salário de outubro"}
        maxLength={120}
        value={form.description}
        onChange={(e) => update("description", e.target.value)}
        error={errors.description}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="categoryId" className="text-sm font-semibold">
          Categoria
        </label>
        <select
          id="categoryId"
          name="categoryId"
          value={form.categoryId}
          onChange={(e) => update("categoryId", e.target.value)}
          aria-invalid={Boolean(errors.categoryId)}
          aria-describedby={errors.categoryId ? "categoryId-message" : undefined}
          className={`rounded-md border bg-white px-3 py-2.5 text-base focus-visible:outline-none focus-visible:ring-2 ${
            errors.categoryId ? "border-expense focus-visible:ring-expense/25" : "border-line focus-visible:border-brand focus-visible:ring-brand/20"
          }`}
        >
          <option value="" disabled>
            {categories.isPending ? "Carregando..." : "Escolha uma categoria"}
          </option>
          {options.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {errors.categoryId ? (
          <p id="categoryId-message" className="text-sm text-expense">
            {errors.categoryId}
          </p>
        ) : (
          categories.isSuccess &&
          options.length === 0 && (
            <p className="text-sm text-muted">
              Você ainda não tem categorias de {isExpense ? "gasto" : "receita"}.{" "}
              <Link href="/plano" className="font-semibold text-brand hover:underline">
                Crie em Meu plano
              </Link>
              .
            </p>
          )
        )}
      </div>

      {isExpense && (
        <Segmented
          legend="Como pagou? (opcional)"
          name="payment"
          value={payment}
          onChange={setPayment}
          options={[
            { value: "DEBIT", label: "Débito" },
            { value: "CREDIT", label: "Crédito" },
            { value: "NONE", label: "Não informar" },
          ]}
        />
      )}

      <div className="mt-1 flex items-center gap-3">
        <Button type="submit" loading={mutation.isPending} loadingText="Salvando...">
          {isExpense ? "Lançar gasto" : "Lançar receita"}
        </Button>
        <Link href="/" className="rounded-md px-4 py-2.5 text-sm font-semibold text-muted hover:bg-brand-soft hover:text-ink">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
