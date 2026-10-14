import { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { dashboardSummaryQuery, type DashboardSummary } from "@finance/types";

// Somas feitas em centavos inteiros para evitar deriva de ponto flutuante.
function toCents(value: Prisma.Decimal | null | undefined) {
  return value ? Math.round(Number(value) * 100) : 0;
}

function fromCents(cents: number) {
  return cents / 100;
}

function startOfMonthUTC(date: Date, monthOffset = 0) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset, 1));
}

function endOfMonthUTC(date: Date) {
  return new Date(startOfMonthUTC(date, 1).getTime() - 1);
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/summary", async (request, reply) => {
    const query = dashboardSummaryQuery.safeParse(request.query);
    if (!query.success) return reply.badRequest(query.error.message);

    const userId = request.user.userId;
    const to = query.data.to ?? endOfMonthUTC(new Date());
    const from = query.data.from ?? startOfMonthUTC(to);
    if (from > to) return reply.badRequest("`from` must be before `to`");

    const periodWhere = { userId, date: { gte: from, lte: to } };
    const monthlyStart = startOfMonthUTC(to, -(query.data.months - 1));

    const [byType, byCategory, byPaymentMethod, monthlyTransactions, debts, goals] =
      await Promise.all([
        app.prisma.transaction.groupBy({
          by: ["type"],
          where: periodWhere,
          _sum: { amount: true },
        }),
        app.prisma.transaction.groupBy({
          by: ["categoryId"],
          where: { ...periodWhere, type: "EXPENSE" },
          _sum: { amount: true },
        }),
        app.prisma.transaction.groupBy({
          by: ["paymentMethod"],
          where: { ...periodWhere, type: "EXPENSE" },
          _sum: { amount: true },
        }),
        app.prisma.transaction.findMany({
          where: { userId, date: { gte: monthlyStart, lte: to } },
          select: { date: true, type: true, amount: true },
        }),
        app.prisma.debt.aggregate({
          where: { userId },
          _count: true,
          _sum: { totalAmount: true, remainingAmount: true, minimumPayment: true },
        }),
        app.prisma.goal.aggregate({
          where: { userId },
          _count: true,
          _sum: { targetAmount: true, currentAmount: true },
        }),
      ]);

    const incomeCents = toCents(byType.find((row) => row.type === "INCOME")?._sum.amount);
    const expenseCents = toCents(byType.find((row) => row.type === "EXPENSE")?._sum.amount);

    const categories = await app.prisma.category.findMany({
      where: { userId, id: { in: byCategory.map((row) => row.categoryId) } },
      select: { id: true, name: true, icon: true, color: true },
    });
    const categoriesById = new Map(categories.map((category) => [category.id, category]));

    const expensesByCategory = byCategory
      .map((row) => {
        const category = categoriesById.get(row.categoryId);
        return {
          categoryId: row.categoryId,
          name: category?.name ?? "",
          icon: category?.icon ?? null,
          color: category?.color ?? null,
          total: fromCents(toCents(row._sum.amount)),
        };
      })
      .sort((a, b) => b.total - a.total);

    const paymentMethodTotal = (method: "CREDIT" | "DEBIT" | null) =>
      fromCents(toCents(byPaymentMethod.find((row) => row.paymentMethod === method)?._sum.amount));

    const monthlyBuckets = new Map<string, { income: number; expense: number }>();
    for (let i = 0; i < query.data.months; i++) {
      monthlyBuckets.set(monthKey(startOfMonthUTC(monthlyStart, i)), { income: 0, expense: 0 });
    }
    for (const transaction of monthlyTransactions) {
      const bucket = monthlyBuckets.get(monthKey(transaction.date));
      if (!bucket) continue;
      if (transaction.type === "INCOME") bucket.income += toCents(transaction.amount);
      else bucket.expense += toCents(transaction.amount);
    }

    const summary: DashboardSummary = {
      period: { from, to },
      totals: {
        income: fromCents(incomeCents),
        expense: fromCents(expenseCents),
        balance: fromCents(incomeCents - expenseCents),
      },
      expensesByCategory,
      expensesByPaymentMethod: {
        CREDIT: paymentMethodTotal("CREDIT"),
        DEBIT: paymentMethodTotal("DEBIT"),
        unspecified: paymentMethodTotal(null),
      },
      monthly: [...monthlyBuckets].map(([month, bucket]) => ({
        month,
        income: fromCents(bucket.income),
        expense: fromCents(bucket.expense),
      })),
      debts: {
        count: debts._count,
        totalAmount: fromCents(toCents(debts._sum.totalAmount)),
        remainingAmount: fromCents(toCents(debts._sum.remainingAmount)),
        minimumPaymentTotal: fromCents(toCents(debts._sum.minimumPayment)),
      },
      goals: {
        count: goals._count,
        targetAmount: fromCents(toCents(goals._sum.targetAmount)),
        currentAmount: fromCents(toCents(goals._sum.currentAmount)),
      },
    };

    return summary;
  });
};
