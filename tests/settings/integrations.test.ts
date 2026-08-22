import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { getIntegrationsOverview } from "@/server/services/integrations";

// The testXConnectionAction Server Actions (src/server/integrations/actions.ts)
// are deliberately not unit-tested here: they call getCurrentUser(), which
// reads the request's cookies via next/headers and throws outside a real
// request scope — the same reason every other *Action wrapper in this repo
// is tested at the service layer instead (see taxAndShipping.test.ts,
// currency.test.ts). Their missing-credential branches and live-provider
// calls are exercised via a real browser session instead.

const PREFIX = "integrations-test-";

const ENV_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "EMAIL_PROVIDER",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMS_API_KEY",
  "SMS_API_SECRET",
  "GOOGLE_CLOUD_STORAGE_BUCKET",
] as const;
const originalEnv: Record<string, string | undefined> = {};

beforeAll(() => {
  for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

afterAll(async () => {
  await prisma.webhookEvent.deleteMany({ where: { eventId: { startsWith: `${PREFIX}evt-` } } });
  await prisma.$disconnect();
});

describe("integrations overview", () => {
  it("reports a provider as not configured when its env vars are unset", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PUBLISHABLE_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const overview = await getIntegrationsOverview();
    const stripe = overview.find((i) => i.key === "stripe")!;
    expect(stripe.configured).toBe(false);
    expect(stripe.envVars.every((v) => !v.configured)).toBe(true);
  });

  it("reports a provider as configured once every required var is set", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.STRIPE_PUBLISHABLE_KEY = "pk_test_fake";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake";

    const overview = await getIntegrationsOverview();
    const stripe = overview.find((i) => i.key === "stripe")!;
    expect(stripe.configured).toBe(true);
  });

  it("never includes the actual credential value, only presence", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_super_secret_value";
    const overview = await getIntegrationsOverview();
    const serialized = JSON.stringify(overview);
    expect(serialized).not.toContain("sk_test_super_secret_value");
  });

  it("switches which env vars it checks based on the configured email/SMS provider", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    const withResend = await getIntegrationsOverview();
    const emailResend = withResend.find((i) => i.key === "email")!;
    expect(emailResend.envVars.map((v) => v.name)).toContain("EMAIL_API_KEY");
    expect(emailResend.envVars.map((v) => v.name)).not.toContain("SMTP_HOST");

    process.env.EMAIL_PROVIDER = "smtp";
    const withSmtp = await getIntegrationsOverview();
    const emailSmtp = withSmtp.find((i) => i.key === "email")!;
    expect(emailSmtp.envVars.map((v) => v.name)).toContain("SMTP_HOST");
  });

  it("reflects a real webhook failure as the most recent activity", async () => {
    await prisma.webhookEvent.create({
      data: {
        provider: "stripe",
        eventId: `${PREFIX}evt-${Date.now()}`,
        eventType: "payment_intent.failed",
        payload: {},
        status: "FAILED",
        error: "Signature verification failed",
      },
    });

    const overview = await getIntegrationsOverview();
    const stripe = overview.find((i) => i.key === "stripe")!;
    expect(stripe.lastActivity?.detail).toContain("FAILED");
    expect(stripe.lastActivity?.detail).toContain("Signature verification failed");
  });
});
