import "server-only";
import { prisma } from "@/server/db";

export interface EnvVarStatus {
  name: string;
  configured: boolean;
}

export interface IntegrationStatus {
  key: string;
  name: string;
  configured: boolean;
  envVars: EnvVarStatus[];
  lastActivity?: { label: string; detail: string } | null;
}

function envStatus(names: string[]): EnvVarStatus[] {
  return names.map((name) => ({ name, configured: Boolean(process.env[name]?.trim()) }));
}

async function lastWebhookActivity(provider: "stripe" | "paypal") {
  const [lastSuccess, lastFailure] = await Promise.all([
    prisma.webhookEvent.findFirst({
      where: { provider, status: "PROCESSED" },
      orderBy: { processedAt: "desc" },
    }),
    prisma.webhookEvent.findFirst({
      where: { provider, status: "FAILED" },
      orderBy: { receivedAt: "desc" },
    }),
  ]);

  if (!lastSuccess && !lastFailure) {
    return { label: "Webhooks", detail: "No webhook events received yet." };
  }
  if (lastFailure && (!lastSuccess || lastFailure.receivedAt > (lastSuccess.processedAt ?? new Date(0)))) {
    return {
      label: "Last webhook",
      detail: `FAILED ${lastFailure.eventType} at ${lastFailure.receivedAt.toISOString()}${lastFailure.error ? ` — ${lastFailure.error}` : ""}`,
    };
  }
  return {
    label: "Last webhook",
    detail: `Processed ${lastSuccess!.eventType} at ${(lastSuccess!.processedAt ?? lastSuccess!.receivedAt).toISOString()}`,
  };
}

async function lastNotificationActivity(channel: "EMAIL" | "SMS") {
  const [last, countLast24h] = await Promise.all([
    prisma.notification.findFirst({ where: { channel }, orderBy: { createdAt: "desc" } }),
    prisma.notification.count({
      where: { channel, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
  ]);

  if (!last) {
    return { label: "Notifications", detail: "None queued yet." };
  }
  // "Queued", not "delivered" — this app logs send failures to stdout
  // (see src/server/logger.ts) but doesn't persist per-notification
  // delivery status, so this can only honestly report that the job ran,
  // not that the provider accepted it.
  return {
    label: "Last queued",
    detail: `${last.type} at ${last.createdAt.toISOString()} — ${countLast24h} in the last 24h`,
  };
}

export async function getIntegrationsOverview(): Promise<IntegrationStatus[]> {
  const [stripeActivity, paypalActivity, emailActivity, smsActivity] = await Promise.all([
    lastWebhookActivity("stripe"),
    lastWebhookActivity("paypal"),
    lastNotificationActivity("EMAIL"),
    lastNotificationActivity("SMS"),
  ]);

  const stripeVars = envStatus(["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"]);
  const paypalVars = envStatus(["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_WEBHOOK_ID"]);

  const emailProvider = process.env.EMAIL_PROVIDER ?? "smtp";
  const emailVars =
    emailProvider === "resend"
      ? envStatus(["EMAIL_API_KEY"])
      : envStatus(["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"]);

  const smsProvider = process.env.SMS_PROVIDER ?? "twilio";
  const smsVars = envStatus(["SMS_API_KEY", "SMS_API_SECRET", "SMS_FROM_NUMBER"]);

  const storageVars = envStatus(["GOOGLE_CLOUD_PROJECT_ID", "GOOGLE_CLOUD_STORAGE_BUCKET"]);

  return [
    {
      key: "stripe",
      name: "Stripe",
      configured: stripeVars.every((v) => v.configured),
      envVars: stripeVars,
      lastActivity: stripeActivity,
    },
    {
      key: "paypal",
      name: "PayPal",
      configured: paypalVars.every((v) => v.configured),
      envVars: paypalVars,
      lastActivity: paypalActivity,
    },
    {
      key: "email",
      name: `Email (${emailProvider})`,
      configured: emailVars.every((v) => v.configured),
      envVars: emailVars,
      lastActivity: emailActivity,
    },
    {
      key: "sms",
      name: `SMS (${smsProvider})`,
      configured: smsVars.every((v) => v.configured),
      envVars: smsVars,
      lastActivity: smsActivity,
    },
    {
      key: "storage",
      name: "Cloud Storage (GCS)",
      configured: storageVars.every((v) => v.configured),
      envVars: storageVars,
      lastActivity: null,
    },
  ];
}
