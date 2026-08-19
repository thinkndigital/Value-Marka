import { Alert } from "@/components/ui/Alert";

export function Forbidden({
  message = "You don't have permission to view this page.",
}: {
  message?: string;
}) {
  return (
    <div className="vm-container py-16">
      <Alert variant="danger">{message}</Alert>
    </div>
  );
}
