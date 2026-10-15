import type { BudgetGroup, CategoryKind } from "@prisma/client";

// Categorias criadas no cadastro, já com a divisão sugerida do plano
// (adaptação da regra 50/30/20 com mais peso em dívidas e reserva).
// O usuário ajusta tudo depois em PUT /budget e no CRUD de categorias.
export const DEFAULT_CATEGORIES: {
  name: string;
  kind: CategoryKind;
  budgetGroup?: BudgetGroup;
  budgetPercent?: number;
}[] = [
  { name: "Moradia e contas", kind: "EXPENSE", budgetGroup: "ESSENTIALS", budgetPercent: 20 },
  { name: "Mercado", kind: "EXPENSE", budgetGroup: "ESSENTIALS", budgetPercent: 15 },
  { name: "Gasolina", kind: "EXPENSE", budgetGroup: "ESSENTIALS", budgetPercent: 10 },
  { name: "Saúde", kind: "EXPENSE", budgetGroup: "ESSENTIALS", budgetPercent: 5 },
  { name: "Quitação de dívidas", kind: "EXPENSE", budgetGroup: "DEBTS", budgetPercent: 15 },
  { name: "Reserva de emergência", kind: "EXPENSE", budgetGroup: "SAVINGS", budgetPercent: 10 },
  { name: "Esporte", kind: "EXPENSE", budgetGroup: "LIFESTYLE", budgetPercent: 5 },
  { name: "Lazer e bobagens", kind: "EXPENSE", budgetGroup: "LIFESTYLE", budgetPercent: 10 },
  { name: "Outros", kind: "EXPENSE", budgetGroup: "LIFESTYLE", budgetPercent: 10 },
  { name: "Salário", kind: "INCOME" },
  { name: "Outras receitas", kind: "INCOME" },
];
