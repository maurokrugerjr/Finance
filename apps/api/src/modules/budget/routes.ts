import { FastifyPluginAsync } from "fastify";
import { PrismaClient, Prisma } from "@prisma/client";
import { budgetUpdateInput, type Budget, type BudgetGroup } from "@finance/types";

const GROUP_ORDER: BudgetGroup[] = ["ESSENTIALS", "DEBTS", "SAVINGS", "LIFESTYLE"];

// Planejado = renda × percentual, arredondado ao centavo.
export function plannedAmount(monthlyIncome: number | null, percent: number) {
  return monthlyIncome === null ? 0 : Math.round(monthlyIncome * percent) / 100;
}

export async function loadBudget(
  prisma: PrismaClient | Prisma.TransactionClient,
  userId: string,
): Promise<Budget> {
  const [user, categories] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { monthlyIncome: true } }),
    prisma.category.findMany({
      where: { userId, kind: "EXPENSE", budgetPercent: { not: null }, budgetGroup: { not: null } },
      select: { id: true, name: true, budgetPercent: true, budgetGroup: true },
    }),
  ]);

  const monthlyIncome = user.monthlyIncome === null ? null : Number(user.monthlyIncome);
  const items = categories
    .map((category) => {
      const percent = Number(category.budgetPercent);
      return {
        categoryId: category.id,
        name: category.name,
        group: category.budgetGroup!,
        percent,
        planned: plannedAmount(monthlyIncome, percent),
      };
    })
    .sort(
      (a, b) =>
        GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
        b.percent - a.percent ||
        a.name.localeCompare(b.name, "pt-BR"),
    );

  // Soma em centésimos de ponto percentual para não acumular erro de float.
  const totalPercent = items.reduce((sum, item) => sum + Math.round(item.percent * 100), 0) / 100;

  return { monthlyIncome, totalPercent, items };
}

export const budgetRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => loadBudget(app.prisma, request.user.userId));

  app.put("/", async (request, reply) => {
    const body = budgetUpdateInput.safeParse(request.body);
    if (!body.success) return reply.badRequest(body.error.message);

    const userId = request.user.userId;
    const { monthlyIncome, items } = body.data;

    const owned = await app.prisma.category.findMany({
      where: { userId, kind: "EXPENSE", id: { in: items.map((item) => item.categoryId) } },
      select: { id: true },
    });
    if (owned.length !== items.length) {
      return reply.badRequest("Every categoryId must be one of your EXPENSE categories");
    }

    return app.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { monthlyIncome } });
      // Substitui o plano inteiro: quem não veio em `items` sai do plano.
      await tx.category.updateMany({
        where: { userId },
        data: { budgetPercent: null, budgetGroup: null },
      });
      for (const item of items) {
        await tx.category.update({
          where: { id: item.categoryId },
          data: { budgetPercent: item.percent, budgetGroup: item.group },
        });
      }
      return loadBudget(tx, userId);
    });
  });
};
