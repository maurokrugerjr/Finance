import { Prisma } from "@prisma/client";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Uma transação em categoria vinculada a uma dívida reduz o saldo restante. */
export async function applyDebtPayment(tx: Prisma.TransactionClient, debtId: string, amount: number) {
  const debt = await tx.debt.findUnique({ where: { id: debtId } });
  if (!debt) return;

  const remainingAmount = clamp(Number(debt.remainingAmount) - amount, 0, Number(debt.totalAmount));
  await tx.debt.update({ where: { id: debtId }, data: { remainingAmount } });
}

/** Editar/apagar essa transação desfaz o abatimento aplicado anteriormente. */
export async function reverseDebtPayment(tx: Prisma.TransactionClient, debtId: string, amount: number) {
  const debt = await tx.debt.findUnique({ where: { id: debtId } });
  if (!debt) return;

  const remainingAmount = clamp(Number(debt.remainingAmount) + amount, 0, Number(debt.totalAmount));
  await tx.debt.update({ where: { id: debtId }, data: { remainingAmount } });
}

/**
 * Aplica a diferença entre o estado anterior e o novo de uma transação nas
 * dívidas vinculadas às categorias envolvidas (criação: previous=null;
 * exclusão: next=null; edição: ambos presentes).
 */
export async function syncDebtsForTransactionChange(
  tx: Prisma.TransactionClient,
  previous: { debtId: string | null; amount: number } | null,
  next: { debtId: string | null; amount: number } | null,
) {
  const previousDebtId = previous?.debtId ?? null;
  const nextDebtId = next?.debtId ?? null;

  if (previousDebtId && previousDebtId === nextDebtId) {
    const delta = next!.amount - previous!.amount;
    if (delta !== 0) await applyDebtPayment(tx, previousDebtId, delta);
    return;
  }

  if (previousDebtId) await reverseDebtPayment(tx, previousDebtId, previous!.amount);
  if (nextDebtId) await applyDebtPayment(tx, nextDebtId, next!.amount);
}
