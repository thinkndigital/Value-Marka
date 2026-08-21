"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { createSegmentAction, type SegmentFormState } from "@/server/crm/actions";

const EXAMPLES = [
  '{"lastOrderDaysAgo":{"gt":90}}',
  '{"totalSpent":{"gte":500}}',
  '{"orderCount":{"gte":3}}',
];

export function SegmentForm() {
  const [state, formAction, pending] = useActionState<SegmentFormState, FormData>(
    createSegmentAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <Input id="name" name="name" label="Segment name" required />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="definition" className="font-display text-sm font-semibold text-text-primary">
          Definition (JSON)
        </label>
        <textarea
          id="definition"
          name="definition"
          rows={3}
          placeholder={EXAMPLES[0]}
          className="vm-focus-ring rounded-md border border-border-default bg-bg-page px-3 py-2 font-mono text-sm text-text-primary"
        />
        <p className="text-xs text-text-muted">
          Examples: {EXAMPLES.join(" · ")}
        </p>
      </div>
      <Button type="submit" variant="primary" loading={pending}>
        Create segment
      </Button>
    </form>
  );
}
