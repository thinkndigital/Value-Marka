"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/dal";
import { UnauthorizedError } from "@/server/rbac";
import { writeAuditLog } from "@/server/audit";
import { addressSchema } from "@/server/validation/address";
import * as addressService from "@/server/services/addresses";
import { AddressError } from "@/server/services/addresses";

export interface AddressFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
}

function parseAddressForm(formData: FormData) {
  return addressSchema.safeParse({
    label: formData.get("label") || undefined,
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    countryCode: formData.get("countryCode"),
    city: formData.get("city"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2") || undefined,
    postalCode: formData.get("postalCode") || undefined,
    isDefault: formData.get("isDefault") === "on",
  });
}

export async function createAddressAction(
  _prevState: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to manage your addresses." };

  const parsed = parseAddressForm(formData);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }

  const address = await addressService.createAddress(user.id, parsed.data);
  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: "address.created",
    entityType: "Address",
    entityId: address.id,
    newValue: { city: address.city, countryCode: address.countryCode },
  });

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  return { success: true };
}

export async function updateAddressAction(
  id: string,
  _prevState: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to manage your addresses." };

  const parsed = parseAddressForm(formData);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }

  try {
    await addressService.updateAddress(user.id, id, parsed.data);
  } catch (err) {
    if (err instanceof AddressError) return { error: err.message };
    throw err;
  }

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  return { success: true };
}

export async function deleteAddressAction(
  id: string,
  _prevState: AddressFormState,
  _formData: FormData,
): Promise<AddressFormState> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    await addressService.deleteAddress(user.id, id);
    revalidatePath("/account/addresses");
    revalidatePath("/checkout");
    return { success: true };
  } catch (err) {
    if (err instanceof AddressError || err instanceof UnauthorizedError) {
      return { error: err.message };
    }
    throw err;
  }
}

export async function setDefaultAddressAction(
  id: string,
  _prevState: AddressFormState,
  _formData: FormData,
): Promise<AddressFormState> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    await addressService.setDefaultAddress(user.id, id);
    revalidatePath("/account/addresses");
    revalidatePath("/checkout");
    return { success: true };
  } catch (err) {
    if (err instanceof AddressError || err instanceof UnauthorizedError) {
      return { error: err.message };
    }
    throw err;
  }
}
