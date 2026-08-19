import { z } from "zod";

export const purchaseOrderLineSchema = z.object({
  productId: z.string().min(1),
  quantityOrdered: z.coerce.number().int().min(1),
  unitCost: z.coerce.number().min(0),
});

export const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "Select a supplier."),
  warehouseId: z.string().min(1, "Select a warehouse."),
  currencyCode: z.string().length(3),
  expectedAt: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  tax: z.coerce.number().min(0).default(0),
  shipping: z.coerce.number().min(0).default(0),
  items: z.array(purchaseOrderLineSchema).min(1, "Add at least one line item."),
});

export const receiveLineSchema = z.object({
  itemId: z.string().min(1),
  quantityReceived: z.coerce.number().int().min(0),
});

export const receivePurchaseOrderSchema = z.object({
  receipts: z.array(receiveLineSchema),
});
