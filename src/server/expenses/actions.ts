"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSellerForAction } from "@/server/auth/seller-guard";
import { getCurrentUser } from "@/server/auth/dal";
import { requirePermission, ForbiddenError, UnauthorizedError } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import { expenseSchema } from "@/server/validation/expense";
import * as expenseService from "@/server/services/expenses";
import { ExpenseError } from "@/server/services/expenses";

export interface ExpenseFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
}

function parseExpenseForm(formData: FormData) {
  return expenseSchema.safeParse({
    category: formData.get("category"),
    description: formData.get("description") || undefined,
    amount: formData.get("amount"),
    currencyCode: formData.get("currencyCode"),
    incurredAt: formData.get("incurredAt") || undefined,
  });
}

function handleError(err: unknown): ExpenseFormState {
  if (err instanceof ExpenseError || err instanceof ForbiddenError || err instanceof UnauthorizedError) {
    return { error: err.message };
  }
  throw err;
}

export async function createExpenseAction(
  _prevState: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  try {
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "expenses.create", seller.id);

    const parsed = parseExpenseForm(formData);
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    const expense = await expenseService.createExpense(seller.id, parsed.data);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "expense.created",
      entityType: "Expense",
      entityId: expense.id,
      newValue: { category: expense.category, amount: expense.amount.toString() },
    });

    revalidatePath("/seller/expenses");
    revalidatePath("/seller/reports");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function deleteExpenseAction(
  id: string,
  _prevState: ExpenseFormState,
  _formData: FormData,
): Promise<ExpenseFormState> {
  try {
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "expenses.delete", seller.id);
    await expenseService.deleteExpense(seller.id, id);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "expense.deleted",
      entityType: "Expense",
      entityId: id,
    });

    revalidatePath("/seller/expenses");
    revalidatePath("/seller/reports");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function createPlatformExpenseAction(
  _prevState: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    await requirePermission(user.id, "expenses.create");

    const parsed = parseExpenseForm(formData);
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    const expense = await expenseService.createPlatformExpense(parsed.data);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "expense.created",
      entityType: "Expense",
      entityId: expense.id,
      newValue: { category: expense.category, amount: expense.amount.toString() },
    });

    revalidatePath("/admin/expenses");
    revalidatePath("/admin/reports");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function deletePlatformExpenseAction(
  id: string,
  _prevState: ExpenseFormState,
  _formData: FormData,
): Promise<ExpenseFormState> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    await requirePermission(user.id, "expenses.delete");
    await expenseService.deleteExpense(null, id);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "expense.deleted",
      entityType: "Expense",
      entityId: id,
    });

    revalidatePath("/admin/expenses");
    revalidatePath("/admin/reports");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}
