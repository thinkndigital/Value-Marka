"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSellerForAction } from "@/server/auth/seller-guard";
import { requirePermission, ForbiddenError, UnauthorizedError } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import { purchaseOrderSchema, receivePurchaseOrderSchema } from "@/server/validation/purchaseOrder";
import * as poService from "@/server/services/purchaseOrders";
import { PurchaseOrderError } from "@/server/services/purchaseOrders";

export interface PurchaseOrderFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  purchaseOrderId?: string;
}

function handleError(err: unknown): PurchaseOrderFormState {
  if (
    err instanceof PurchaseOrderError ||
    err instanceof ForbiddenError ||
    err instanceof UnauthorizedError
  ) {
    return { error: err.message };
  }
  throw err;
}

export async function createPurchaseOrderAction(
  _prevState: PurchaseOrderFormState,
  formData: FormData,
): Promise<PurchaseOrderFormState> {
  try {
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "purchaseOrders.create", seller.id);

    let items: unknown;
    try {
      items = JSON.parse(String(formData.get("itemsJson") ?? "[]"));
    } catch {
      return { error: "Invalid line items." };
    }

    const parsed = purchaseOrderSchema.safeParse({
      supplierId: formData.get("supplierId"),
      warehouseId: formData.get("warehouseId"),
      currencyCode: formData.get("currencyCode"),
      expectedAt: formData.get("expectedAt") || undefined,
      tax: formData.get("tax") || 0,
      shipping: formData.get("shipping") || 0,
      items,
    });
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    const po = await poService.createPurchaseOrder(seller.id, parsed.data);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "purchaseOrder.created",
      entityType: "PurchaseOrder",
      entityId: po.id,
      newValue: { total: po.total.toString() },
    });

    revalidatePath("/seller/purchase-orders");
    return { success: true, purchaseOrderId: po.id };
  } catch (err) {
    return handleError(err);
  }
}

export async function submitPurchaseOrderAction(
  id: string,
  _prevState: PurchaseOrderFormState,
  _formData: FormData,
): Promise<PurchaseOrderFormState> {
  try {
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "purchaseOrders.update", seller.id);
    await poService.submitPurchaseOrder(seller.id, id);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "purchaseOrder.submitted",
      entityType: "PurchaseOrder",
      entityId: id,
    });

    revalidatePath(`/seller/purchase-orders/${id}`);
    revalidatePath("/seller/purchase-orders");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function cancelPurchaseOrderAction(
  id: string,
  _prevState: PurchaseOrderFormState,
  _formData: FormData,
): Promise<PurchaseOrderFormState> {
  try {
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "purchaseOrders.update", seller.id);
    await poService.cancelPurchaseOrder(seller.id, id);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "purchaseOrder.cancelled",
      entityType: "PurchaseOrder",
      entityId: id,
    });

    revalidatePath(`/seller/purchase-orders/${id}`);
    revalidatePath("/seller/purchase-orders");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function receivePurchaseOrderAction(
  id: string,
  _prevState: PurchaseOrderFormState,
  formData: FormData,
): Promise<PurchaseOrderFormState> {
  try {
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "purchaseOrders.update", seller.id);

    let receipts: unknown;
    try {
      receipts = JSON.parse(String(formData.get("receiptsJson") ?? "[]"));
    } catch {
      return { error: "Invalid receiving quantities." };
    }

    const parsed = receivePurchaseOrderSchema.safeParse({ receipts });
    if (!parsed.success) {
      return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    await poService.receivePurchaseOrderItems(seller.id, id, parsed.data.receipts, user.id);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "purchaseOrder.received",
      entityType: "PurchaseOrder",
      entityId: id,
      newValue: { receipts: parsed.data.receipts },
    });

    revalidatePath(`/seller/purchase-orders/${id}`);
    revalidatePath("/seller/purchase-orders");
    revalidatePath("/seller/warehouses");
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}

export async function markPurchaseOrderPaidAction(
  id: string,
  _prevState: PurchaseOrderFormState,
  _formData: FormData,
): Promise<PurchaseOrderFormState> {
  try {
    const { user, seller } = await requireSellerForAction();
    await requirePermission(user.id, "purchaseOrders.update", seller.id);
    await poService.markPurchaseOrderPaid(seller.id, id);

    await writeAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "purchaseOrder.paid",
      entityType: "PurchaseOrder",
      entityId: id,
    });

    revalidatePath(`/seller/purchase-orders/${id}`);
    return { success: true };
  } catch (err) {
    return handleError(err);
  }
}
