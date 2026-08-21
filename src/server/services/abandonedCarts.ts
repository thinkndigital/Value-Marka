import "server-only";
import { prisma } from "@/server/db";
import { sendEmailNotification } from "@/server/notifications/send";
import { abandonedCartEmail } from "@/server/notifications/templates";

const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Finds carts belonging to a registered user, with items, last touched more
 * than 24h ago, that haven't already had a recovery email sent since they
 * were last updated (checked via the Notification log — there's no
 * dedicated "reminded" flag on Cart). Sends the recovery email for each.
 * Returns how many were sent, for the caller (the scheduler route) to log.
 */
export async function runAbandonedCartRecovery(): Promise<{ sent: number }> {
  const cutoff = new Date(Date.now() - ABANDONED_AFTER_MS);

  const carts = await prisma.cart.findMany({
    where: {
      userId: { not: null },
      updatedAt: { lt: cutoff },
      items: { some: {} },
    },
    include: {
      items: true,
      user: { select: { id: true, email: true, firstName: true } },
    },
  });

  let sent = 0;
  for (const cart of carts) {
    if (!cart.user) continue;

    const alreadyReminded = await prisma.notification.findFirst({
      where: {
        userId: cart.user.id,
        type: "abandoned_cart",
        createdAt: { gt: cart.updatedAt },
      },
    });
    if (alreadyReminded) continue;

    const template = abandonedCartEmail(cart.items.length);
    sendEmailNotification({
      userId: cart.user.id,
      to: cart.user.email,
      type: "abandoned_cart",
      subject: template.subject,
      html: template.html,
    });
    sent += 1;
  }

  return { sent };
}
