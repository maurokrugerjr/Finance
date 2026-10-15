import { useQuery } from "@tanstack/react-query";
import type { Budget, Category, DashboardSummary, Transaction } from "@finance/types";
import { apiFetch } from "./api";
import { monthRange, type MonthKey } from "./month";

export type TransactionWithCategory = Transaction & { category: Category };

// Chaves centralizadas para invalidar tudo que depende de lançamentos/plano.
export const queryKeys = {
  summary: (month: MonthKey) => ["summary", month] as const,
  transactions: (month: MonthKey) => ["transactions", month] as const,
  budget: ["budget"] as const,
  categories: ["categories"] as const,
};

export function useSummary(month: MonthKey) {
  const { from, to } = monthRange(month);
  return useQuery({
    queryKey: queryKeys.summary(month),
    queryFn: () => apiFetch<DashboardSummary>(`/dashboard/summary?from=${from}&to=${to}&months=6`),
  });
}

export function useMonthTransactions(month: MonthKey) {
  const { from, to } = monthRange(month);
  return useQuery({
    queryKey: queryKeys.transactions(month),
    queryFn: () => apiFetch<TransactionWithCategory[]>(`/transactions?from=${from}&to=${to}`),
  });
}

export function useBudget() {
  return useQuery({ queryKey: queryKeys.budget, queryFn: () => apiFetch<Budget>("/budget") });
}

export function useCategories() {
  return useQuery({ queryKey: queryKeys.categories, queryFn: () => apiFetch<Category[]>("/categories") });
}
