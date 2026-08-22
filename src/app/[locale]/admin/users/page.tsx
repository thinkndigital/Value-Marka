import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Link } from "@/i18n/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { parsePage } from "@/server/pagination";
import { listUsersPage } from "@/server/services/users";

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { locale } = await params;
  const { page: pageParam, q } = await searchParams;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "users.read"))) {
    return <Forbidden />;
  }

  const page = parsePage(pageParam);
  const search = q?.trim() ?? "";
  const { items: users, totalPages } = await listUsersPage(page, search);

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">Users</h1>

      <form className="flex items-end gap-2" method="get">
        <Input id="q" name="q" label="Search by name or email" defaultValue={search} className="max-w-sm" />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {users.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <div className="flex flex-col gap-3">
          {users.map((item) => (
            <Link key={item.id} href={`/admin/users/${item.id}`}>
              <Card className="hover:bg-bg-sunken">
                <CardBody className="flex items-center justify-between">
                  <div>
                    <p className="font-display font-semibold text-text-primary">
                      {item.firstName} {item.lastName}
                    </p>
                    <p className="text-sm text-text-muted">{item.email}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {item.roleKeys.length === 0 ? (
                      <Badge variant="neutral">No roles</Badge>
                    ) : (
                      item.roleKeys.map((key) => (
                        <Badge key={key} variant={key === "SUPER_ADMIN" ? "brand" : "info"}>
                          {key}
                        </Badge>
                      ))
                    )}
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} basePath="/admin/users" extraQuery={{ q: search }} />
    </div>
  );
}
