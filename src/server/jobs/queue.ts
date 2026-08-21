import "server-only";
import { logger } from "@/server/logger";

/**
 * Background job abstraction (ARCHITECTURE.md §10). No feature is allowed
 * to do real work (send an email, call a webhook, recompute affiliate
 * commission) synchronously inside a request — it enqueues a job instead.
 *
 * In production this would hand off to Cloud Tasks, which invokes a Route
 * Handler that calls `runJob` directly; `next dev`/tests without Cloud
 * Tasks configured fall back to an in-process `setImmediate` runner so
 * local development never requires GCP credentials. Either way the actual
 * work — and any network call it makes (send an email, hit an API) — runs
 * for real; nothing here is a mock.
 */

export type JobName = keyof JobPayloads;

export interface JobPayloads {
  "notification.send": {
    userId: string;
    channel: "EMAIL" | "SMS";
    type: string;
    title: string;
    body: string;
    to: string;
  };
}

type JobHandler<T extends JobName> = (payload: JobPayloads[T]) => Promise<void>;

const registry = new Map<JobName, JobHandler<JobName>>();

export function registerJob<T extends JobName>(name: T, handler: JobHandler<T>) {
  registry.set(name, handler as JobHandler<JobName>);
}

export async function runJob<T extends JobName>(name: T, payload: JobPayloads[T]) {
  const handler = registry.get(name);
  if (!handler) throw new Error(`No job handler registered for "${name}".`);
  await handler(payload);
}

/**
 * Enqueues a job. Cloud Tasks isn't configured in this environment
 * (`CLOUD_TASKS_QUEUE` unset), so this always takes the in-process path —
 * still asynchronous relative to the caller (via setImmediate), still a
 * real call to the job handler, just not durable across a process
 * restart. Swapping in a real `@google-cloud/tasks` client here later is a
 * one-function change; nothing that calls `enqueue` needs to know.
 */
export function enqueue<T extends JobName>(name: T, payload: JobPayloads[T]) {
  const queueConfigured = Boolean(process.env.CLOUD_TASKS_QUEUE && process.env.CLOUD_TASKS_HANDLER_URL);

  if (queueConfigured) {
    // Fire-and-forget HTTP call to the Cloud Tasks handler URL, matching
    // how a real Cloud Tasks-invoked Route Handler would be reached.
    // Left as a real fetch call rather than the actual @google-cloud/tasks
    // client, which needs project/queue credentials this environment
    // doesn't have — see IMPLEMENTATION_PLAN.md Phase 7.
    fetch(process.env.CLOUD_TASKS_HANDLER_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, payload }),
    }).catch((err) => {
      logger.error(`Failed to enqueue job "${name}" via Cloud Tasks handler`, {
        job: name,
        error: err instanceof Error ? err.message : String(err),
      });
    });
    return;
  }

  setImmediate(() => {
    runJob(name, payload).catch((err) => {
      logger.error(`Job "${name}" failed`, {
        job: name,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  });
}
