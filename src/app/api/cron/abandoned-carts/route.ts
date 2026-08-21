import { NextResponse } from "next/server";
import { runAbandonedCartRecovery } from "@/server/services/abandonedCarts";

/**
 * Intended to be called by Cloud Scheduler (a real, periodic HTTP trigger)
 * — not by a live cron in this sandbox. Cloud Scheduler is configured to
 * send `Authorization: Bearer $CRON_SECRET`; see DEPLOYMENT.md once wired
 * up there.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await runAbandonedCartRecovery();
  return NextResponse.json(result);
}
