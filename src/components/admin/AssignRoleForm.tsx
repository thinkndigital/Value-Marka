"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { assignRoleAction, type UserRoleActionState } from "@/server/users/actions";

export function AssignRoleForm({
  userId,
  roles,
}: {
  userId: string;
  roles: { id: string; key: string; name: string }[];
}) {
  const boundAction = assignRoleAction.bind(null, userId);
  const [state, formAction, pending] = useActionState<UserRoleActionState, FormData>(boundAction, {});

  if (roles.length === 0) return null;

  return (
    <form action={formAction} className="flex items-end gap-2">
      {state.error ? (
        <div className="w-full">
          <Alert variant="danger">{state.error}</Alert>
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="roleId" className="font-display text-sm font-semibold text-text-primary">
          Assign role
        </label>
        <select
          id="roleId"
          name="roleId"
          className="vm-focus-ring h-11 rounded-md border border-border-default bg-bg-surface px-3.5 text-sm text-text-primary"
        >
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="secondary" loading={pending}>
        Assign
      </Button>
    </form>
  );
}
