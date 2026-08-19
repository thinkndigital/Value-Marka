import "server-only";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/server/db";
import { ForbiddenError, UnauthorizedError } from "@/server/rbac";
import { getCurrentUser } from "./dal";
import { requireUser } from "./guards";

/**
 * Redirects to /sell unless the signed-in user has an APPROVED Seller
 * account. Every /seller/** page calls this first — it's the seller-surface
 * equivalent of requireUser, and its return value (`seller.id`) is what
 * every subsequent query in this session scopes to (ARCHITECTURE.md §5).
 */
export async function requireApprovedSeller(locale: string) {
  const user = await requireUser(locale);
  const seller = await prisma.seller.findUnique({ where: { userId: user.id } });

  if (!seller || seller.status !== "APPROVED") {
    redirect({ href: "/sell", locale });
    throw new Error("unreachable");
  }

  return { user, seller };
}

/**
 * Same check as requireApprovedSeller, for Server Actions and Route
 * Handlers — throws instead of redirecting, since those have no page to
 * redirect from.
 */
export async function requireSellerForAction() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();

  const seller = await prisma.seller.findUnique({ where: { userId: user.id } });
  if (!seller || seller.status !== "APPROVED") {
    throw new ForbiddenError("Your seller account isn't approved.");
  }

  return { user, seller };
}
