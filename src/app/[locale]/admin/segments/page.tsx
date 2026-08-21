import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { listSegments, evaluateSegment } from "@/server/services/crm";
import { deleteSegmentAction } from "@/server/crm/actions";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { SegmentForm } from "@/components/SegmentForm";

export default async function AdminSegmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "customers.read"))) {
    return <Forbidden />;
  }

  const segments = await listSegments();
  const withCounts = await Promise.all(
    segments.map(async (segment) => ({
      segment,
      memberCount: (await evaluateSegment(segment.definition)).length,
    })),
  );

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">Customer segments</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          {withCounts.length === 0 ? (
            <EmptyState title="No segments yet" />
          ) : (
            withCounts.map(({ segment, memberCount }) => (
              <Card key={segment.id}>
                <CardBody className="flex items-center justify-between">
                  <div>
                    <p className="font-display font-semibold text-text-primary">{segment.name}</p>
                    <p className="text-sm text-text-muted">
                      {JSON.stringify(segment.definition)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="brand">{memberCount} customers</Badge>
                    <DeleteButton
                      action={deleteSegmentAction.bind(null, segment.id)}
                      confirmMessage="Delete this segment?"
                      label="Delete"
                    />
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>

        <Card>
          <CardBody>
            <SegmentForm />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
