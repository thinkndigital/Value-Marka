import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

interface AuditLogInput {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

/**
 * Every sensitive mutation writes one of these (spec §36). Never awaited in
 * a way that can block or fail the caller's request — a logging failure
 * must not prevent the underlying action, but it is still awaited here
 * because Server Actions/Route Handlers run to completion regardless, and
 * silently losing audit rows would defeat the point.
 */
export async function writeAuditLog(input: AuditLogInput) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      oldValue: input.oldValue,
      newValue: input.newValue,
      ipAddress: input.ipAddress ?? null,
    },
  });
}
