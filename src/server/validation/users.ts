import { z } from "zod";

export const assignRoleSchema = z.object({
  roleId: z.uuid("Pick a role"),
});
