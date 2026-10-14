import { z } from "zod";

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
});
export type User = z.infer<typeof userSchema>;

export const registerInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  name: z.string().trim().min(1).max(120).optional(),
});
export type RegisterInput = z.infer<typeof registerInput>;

export const loginInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginInput>;

export const authResponse = z.object({
  user: userSchema,
  token: z.string(),
});
export type AuthResponse = z.infer<typeof authResponse>;

export const CategoryKind = z.enum(["INCOME", "EXPENSE"]);
export type CategoryKind = z.infer<typeof CategoryKind>;

export const PaymentMethod = z.enum(["DEBIT", "CREDIT"]);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const DebtStrategy = z.enum(["SNOWBALL", "AVALANCHE"]);
export type DebtStrategy = z.infer<typeof DebtStrategy>;

export const categorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  kind: CategoryKind,
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  // Quando definido (só permitido em categorias EXPENSE), toda transação
  // lançada nesta categoria desconta automaticamente da dívida vinculada.
  debtId: z.string().uuid().nullable().optional(),
});
export type Category = z.infer<typeof categorySchema>;

export const categoryCreateInput = categorySchema.omit({ id: true });
export type CategoryCreateInput = z.infer<typeof categoryCreateInput>;

export const categoryUpdateInput = categoryCreateInput.partial();
export type CategoryUpdateInput = z.infer<typeof categoryUpdateInput>;

export const transactionSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1),
  amount: z.number().positive(),
  type: CategoryKind,
  date: z.coerce.date(),
  notes: z.string().nullable().optional(),
  // Crédito ou débito — opcional (receitas normalmente não têm).
  paymentMethod: PaymentMethod.nullable().optional(),
  categoryId: z.string().uuid(),
});
export type Transaction = z.infer<typeof transactionSchema>;

export const transactionCreateInput = transactionSchema.omit({ id: true });
export type TransactionCreateInput = z.infer<typeof transactionCreateInput>;

export const transactionUpdateInput = transactionCreateInput.partial();
export type TransactionUpdateInput = z.infer<typeof transactionUpdateInput>;

export const debtSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  totalAmount: z.number().positive(),
  remainingAmount: z.number().nonnegative(),
  interestRate: z.number().nonnegative(),
  minimumPayment: z.number().nonnegative(),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
});
export type Debt = z.infer<typeof debtSchema>;

export const debtCreateInput = debtSchema
  .omit({ id: true, remainingAmount: true })
  .extend({ remainingAmount: z.number().nonnegative().optional() });
export type DebtCreateInput = z.infer<typeof debtCreateInput>;

export const debtUpdateInput = debtCreateInput.partial();
export type DebtUpdateInput = z.infer<typeof debtUpdateInput>;

export const simulateDebtsInput = z.object({
  extraMonthlyPayment: z.number().nonnegative().default(0),
});
export type SimulateDebtsInput = z.infer<typeof simulateDebtsInput>;

export const debtPayoffStepSchema = z.object({
  debtId: z.string().uuid(),
  name: z.string(),
  month: z.number().int().positive(),
});
export type DebtPayoffStep = z.infer<typeof debtPayoffStepSchema>;

export const debtPayoffPlanSchema = z.object({
  strategy: DebtStrategy,
  possible: z.boolean(),
  months: z.number().int().nonnegative().nullable(),
  totalInterestPaid: z.number().nonnegative(),
  debtFreeDate: z.coerce.date().nullable(),
  payoffOrder: z.array(debtPayoffStepSchema),
  message: z.string().optional(),
});
export type DebtPayoffPlan = z.infer<typeof debtPayoffPlanSchema>;

export const debtSimulationResponse = z.object({
  snowball: debtPayoffPlanSchema,
  avalanche: debtPayoffPlanSchema,
});
export type DebtSimulationResponse = z.infer<typeof debtSimulationResponse>;

export const goalSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  targetAmount: z.number().positive(),
  currentAmount: z.number().nonnegative(),
  targetDate: z.coerce.date().nullable().optional(),
});
export type Goal = z.infer<typeof goalSchema>;

export const goalCreateInput = goalSchema
  .omit({ id: true, currentAmount: true })
  .extend({ currentAmount: z.number().nonnegative().optional() });
export type GoalCreateInput = z.infer<typeof goalCreateInput>;

export const goalUpdateInput = goalCreateInput.partial();
export type GoalUpdateInput = z.infer<typeof goalUpdateInput>;

export const goalContributionSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().positive(),
  date: z.coerce.date(),
});
export type GoalContribution = z.infer<typeof goalContributionSchema>;

export const goalContributionCreateInput = goalContributionSchema.omit({ id: true });
export type GoalContributionCreateInput = z.infer<typeof goalContributionCreateInput>;

// Período padrão do resumo: mês corrente (UTC). `from`/`to` são inclusivos,
// como nos filtros de /transactions; `months` controla a série mensal.
export const dashboardSummaryQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  months: z.coerce.number().int().min(1).max(24).default(6),
});
export type DashboardSummaryQuery = z.infer<typeof dashboardSummaryQuery>;

export const dashboardSummarySchema = z.object({
  period: z.object({ from: z.coerce.date(), to: z.coerce.date() }),
  totals: z.object({
    income: z.number(),
    expense: z.number(),
    balance: z.number(),
  }),
  expensesByCategory: z.array(
    z.object({
      categoryId: z.string().uuid(),
      name: z.string(),
      icon: z.string().nullable(),
      color: z.string().nullable(),
      total: z.number(),
    }),
  ),
  // Gastos sem paymentMethod informado entram em `unspecified`.
  expensesByPaymentMethod: z.object({
    CREDIT: z.number(),
    DEBIT: z.number(),
    unspecified: z.number(),
  }),
  // Últimos `months` meses terminando no mês de `to`, formato "YYYY-MM" (UTC),
  // incluindo meses sem lançamentos (zerados).
  monthly: z.array(
    z.object({
      month: z.string(),
      income: z.number(),
      expense: z.number(),
    }),
  ),
  debts: z.object({
    count: z.number().int(),
    totalAmount: z.number(),
    remainingAmount: z.number(),
    minimumPaymentTotal: z.number(),
  }),
  goals: z.object({
    count: z.number().int(),
    targetAmount: z.number(),
    currentAmount: z.number(),
  }),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
