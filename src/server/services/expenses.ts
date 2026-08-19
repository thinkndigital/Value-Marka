import "server-only";
import type { ExpenseCategory, Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

export class ExpenseError extends Error {}

interface ExpenseInput {
  category: ExpenseCategory;
  description?: string;
  amount: number;
  currencyCode: string;
  incurredAt?: Date;
}

async function createExpenseRow(
  sellerId: string | null,
  input: ExpenseInput,
  subjectType: "SELLER" | "PLATFORM",
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const expense = await tx.expense.create({
      data: {
        sellerId,
        category: input.category,
        description: input.description,
        amount: input.amount,
        currencyCode: input.currencyCode,
        incurredAt: input.incurredAt ?? new Date(),
      },
    });

    await tx.ledgerEntry.create({
      data: {
        type: "EXPENSE",
        amount: -input.amount,
        currencyCode: input.currencyCode,
        subjectType,
        subjectId: sellerId,
        referenceType: "Expense",
        referenceId: expense.id,
        description: input.description ?? input.category,
      },
    });

    return expense;
  });
}

export function createExpense(sellerId: string, input: ExpenseInput) {
  return createExpenseRow(sellerId, input, "SELLER");
}

export function createPlatformExpense(input: ExpenseInput) {
  return createExpenseRow(null, input, "PLATFORM");
}

export function listExpensesForSeller(sellerId: string) {
  return prisma.expense.findMany({ where: { sellerId }, orderBy: { incurredAt: "desc" } });
}

export function listPlatformExpenses() {
  return prisma.expense.findMany({ where: { sellerId: null }, orderBy: { incurredAt: "desc" } });
}

export async function deleteExpense(sellerId: string | null, id: string) {
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) throw new ExpenseError("Expense not found.");
  if (expense.sellerId !== sellerId) throw new ExpenseError("This expense belongs to a different seller.");

  await prisma.$transaction([
    prisma.ledgerEntry.deleteMany({ where: { referenceType: "Expense", referenceId: id } }),
    prisma.expense.delete({ where: { id } }),
  ]);
}
