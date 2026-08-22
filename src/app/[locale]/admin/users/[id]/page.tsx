import { notFound } from "next/navigation";
import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FormActionButton } from "@/components/admin/FormActionButton";
import { AssignRoleForm } from "@/components/admin/AssignRoleForm";
import { getUserForAdmin, listAssignableRoles } from "@/server/services/users";
import { removeRoleAction } from "@/server/users/actions";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const currentUser = await requireUser(locale);

  if (!(await hasPermission(currentUser.id, "users.read"))) {
    return <Forbidden />;
  }

  const [target, allRoles] = await Promise.all([getUserForAdmin(id), listAssignableRoles()]);
  if (!target) notFound();

  const canManageRoles = await hasPermission(currentUser.id, "users.update");
  const assignedRoleIds = new Set(target.userRoles.map((r) => r.roleId));
  const availableRoles = allRoles.filter((r) => !assignedRoleIds.has(r.id));

  return (
    <div className="vm-container flex max-w-2xl flex-col gap-6 py-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">
          {target.firstName} {target.lastName}
        </h1>
        <p className="text-sm text-text-muted">{target.email}</p>
        <p className="text-sm text-text-muted">
          Joined {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(target.createdAt)} ·{" "}
          {target.status}
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-display font-semibold text-text-primary">Roles</h2>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          {target.userRoles.length === 0 ? (
            <p className="text-sm text-text-muted">No roles assigned.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {target.userRoles.map((userRole) => (
                <li key={userRole.id} className="flex items-center justify-between gap-3">
                  <Badge variant={userRole.roleKey === "SUPER_ADMIN" ? "brand" : "info"}>
                    {userRole.roleName}
                  </Badge>
                  {canManageRoles ? (
                    <FormActionButton
                      action={removeRoleAction.bind(null, target.id, userRole.id)}
                      label="Remove"
                      variant="outline"
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {canManageRoles ? <AssignRoleForm userId={target.id} roles={availableRoles} /> : null}
        </CardBody>
      </Card>
    </div>
  );
}
