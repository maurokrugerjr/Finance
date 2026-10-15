"use client";

import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CategoryKind } from "@finance/types";
import { Button } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { queryKeys } from "@/lib/queries";

// Tudo que mostra categorias ou plano precisa ser recarregado após mudanças.
export function useInvalidatePlan() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [queryKeys.categories, queryKeys.budget, ["summary"], ["transactions"]].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
}

function categoryErrorMessage(error: unknown, kind: CategoryKind) {
  if (error instanceof ApiError && error.status === 409) {
    return error.message.includes("transactions")
      ? "Essa categoria tem lançamentos e não pode ser apagada. Renomeie-a se quiser mudar o nome."
      : `Já existe uma categoria de ${kind === "EXPENSE" ? "gasto" : "receita"} com esse nome.`;
  }
  return errorMessage(error);
}

const inputClass =
  "w-full min-w-0 rounded-md border border-line bg-white px-3 py-2 text-sm focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20";
const linkButton =
  "rounded px-2 py-1 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:opacity-50";

export function NewCategoryForm({ kind }: { kind: CategoryKind }) {
  const invalidate = useInvalidatePlan();
  const inputId = useId();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();

  const mutation = useMutation({
    mutationFn: (newName: string) => apiFetch("/categories", { method: "POST", body: JSON.stringify({ name: newName, kind }) }),
    onSuccess: async () => {
      setName("");
      await invalidate();
    },
    onError: (err) => setError(categoryErrorMessage(err, kind)),
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Digite o nome da categoria.");
      return;
    }
    mutation.mutate(trimmed);
  }

  const label = kind === "EXPENSE" ? "Nova categoria de gasto" : "Nova categoria de receita";

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-4 border-t border-line pt-4">
      <label htmlFor={inputId} className="text-sm font-semibold">
        {label}
      </label>
      <div className="mt-1.5 flex max-w-md gap-2">
        <input
          id={inputId}
          value={name}
          maxLength={60}
          placeholder={kind === "EXPENSE" ? "Ex.: Pets, Assinaturas" : "Ex.: Freela, Reembolso"}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          onChange={(e) => {
            setName(e.target.value);
            setError(undefined);
          }}
          className={inputClass}
        />
        <Button type="submit" loading={mutation.isPending} loadingText="Criando..." className="shrink-0">
          Criar
        </Button>
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-sm text-expense">
          {error}
        </p>
      ) : (
        kind === "EXPENSE" && (
          <p className="mt-1.5 text-sm text-muted">Ela entra como &ldquo;Fora do plano&rdquo;; depois escolha o grupo e a porcentagem.</p>
        )
      )}
    </form>
  );
}

// Renomear e apagar valem na hora. Apagar pede confirmação na própria linha.
export function CategoryActions({ id, name, kind }: { id: string; name: string; kind: CategoryKind }) {
  const invalidate = useInvalidatePlan();
  const [mode, setMode] = useState<"idle" | "rename" | "confirmDelete">("idle");
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string>();

  const rename = useMutation({
    mutationFn: (newName: string) => apiFetch(`/categories/${id}`, { method: "PATCH", body: JSON.stringify({ name: newName }) }),
    onSuccess: async () => {
      setMode("idle");
      await invalidate();
    },
    onError: (err) => setError(categoryErrorMessage(err, kind)),
  });

  const remove = useMutation({
    mutationFn: () => apiFetch(`/categories/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError: (err) => {
      setMode("idle");
      setError(categoryErrorMessage(err, kind));
    },
  });

  function startRename() {
    setDraft(name);
    setError(undefined);
    setMode("rename");
  }

  function submitRename(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return setError("Digite o nome da categoria.");
    if (trimmed === name) return setMode("idle");
    rename.mutate(trimmed);
  }

  return (
    <div className="col-span-2 flex flex-col items-start gap-1 md:col-span-1 md:items-end">
      {mode === "rename" ? (
        <form onSubmit={submitRename} className="flex w-full gap-1">
          <input
            autoFocus
            aria-label={`Novo nome para ${name}`}
            value={draft}
            maxLength={60}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(undefined);
            }}
            onKeyDown={(e) => e.key === "Escape" && setMode("idle")}
            className={inputClass}
          />
          <button type="submit" disabled={rename.isPending} className={`${linkButton} text-brand hover:bg-brand-soft`}>
            Salvar
          </button>
        </form>
      ) : mode === "confirmDelete" ? (
        <div className="flex items-center gap-1 text-sm">
          <span className="text-muted">Apagar?</span>
          <button
            type="button"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            className={`${linkButton} text-expense hover:bg-expense/10`}
          >
            Sim, apagar
          </button>
          <button type="button" onClick={() => setMode("idle")} className={`${linkButton} text-muted hover:bg-brand-soft`}>
            Não
          </button>
        </div>
      ) : (
        <div className="flex gap-1">
          <button type="button" onClick={startRename} className={`${linkButton} text-brand hover:bg-brand-soft`} aria-label={`Renomear ${name}`}>
            Renomear
          </button>
          <button
            type="button"
            onClick={() => {
              setError(undefined);
              setMode("confirmDelete");
            }}
            className={`${linkButton} text-muted hover:bg-expense/10 hover:text-expense`}
            aria-label={`Apagar ${name}`}
          >
            Apagar
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-expense md:text-right">
          {error}
        </p>
      )}
    </div>
  );
}
