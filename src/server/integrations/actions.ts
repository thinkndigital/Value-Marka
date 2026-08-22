"use server";

import { getCurrentUser } from "@/server/auth/dal";
import { ForbiddenError, UnauthorizedError, requirePermission } from "@/server/rbac";

export interface TestConnectionState {
  error?: string;
  detail?: string;
  success?: boolean;
}

async function requireSettingsAccess() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  await requirePermission(user.id, "settings.update");
}

function handleError(err: unknown): TestConnectionState {
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
    return { error: err.message };
  }
  return { error: err instanceof Error ? err.message : "Connection test failed." };
}

/**
 * Every check below is a real, read-only call to the actual provider —
 * triggered only by an admin clicking the button, never automatically —
 * and never echoes the credential back, only whether it worked.
 */

export async function testStripeConnectionAction(
  _prevState: TestConnectionState,
  _formData: FormData,
): Promise<TestConnectionState> {
  try {
    await requireSettingsAccess();
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return { error: "STRIPE_SECRET_KEY is not set." };

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(key);
    const balance = await stripe.balance.retrieve();
    const available = balance.available[0];
    return {
      success: true,
      detail: available
        ? `Connected — available balance: ${(available.amount / 100).toFixed(2)} ${available.currency.toUpperCase()}`
        : "Connected.",
    };
  } catch (err) {
    return handleError(err);
  }
}

export async function testPaypalConnectionAction(
  _prevState: TestConnectionState,
  _formData: FormData,
): Promise<TestConnectionState> {
  try {
    await requireSettingsAccess();
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    if (!clientId || !clientSecret) return { error: "PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET are not set." };

    const base =
      process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
    const response = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!response.ok) {
      return { error: `PayPal rejected the credentials (HTTP ${response.status}).` };
    }
    return { success: true, detail: `Connected to PayPal ${process.env.PAYPAL_ENV ?? "sandbox"}.` };
  } catch (err) {
    return handleError(err);
  }
}

export async function testEmailConnectionAction(
  _prevState: TestConnectionState,
  _formData: FormData,
): Promise<TestConnectionState> {
  try {
    await requireSettingsAccess();
    const provider = process.env.EMAIL_PROVIDER ?? "smtp";

    if (provider === "resend") {
      const apiKey = process.env.EMAIL_API_KEY;
      if (!apiKey) return { error: "EMAIL_API_KEY is not set." };
      const response = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) return { error: `Resend rejected the API key (HTTP ${response.status}).` };
      return { success: true, detail: "Connected to Resend." };
    }

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    if (!host || !user || !pass) return { error: "SMTP_HOST/SMTP_USER/SMTP_PASSWORD are not set." };

    const { default: nodemailer } = await import("nodemailer");
    const port = Number(process.env.SMTP_PORT ?? 587);
    const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    await transport.verify();
    return { success: true, detail: `Connected to ${host}.` };
  } catch (err) {
    return handleError(err);
  }
}

export async function testSmsConnectionAction(
  _prevState: TestConnectionState,
  _formData: FormData,
): Promise<TestConnectionState> {
  try {
    await requireSettingsAccess();
    const provider = process.env.SMS_PROVIDER ?? "twilio";
    const apiKey = process.env.SMS_API_KEY;
    const apiSecret = process.env.SMS_API_SECRET;
    if (!apiKey || !apiSecret) return { error: "SMS_API_KEY/SMS_API_SECRET are not set." };

    if (provider === "messagebird") {
      const response = await fetch("https://rest.messagebird.com/balance", {
        headers: { Authorization: `AccessKey ${apiSecret}` },
      });
      if (!response.ok) return { error: `MessageBird rejected the key (HTTP ${response.status}).` };
      return { success: true, detail: "Connected to MessageBird." };
    }

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${apiKey}.json`, {
      headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}` },
    });
    if (!response.ok) return { error: `Twilio rejected the credentials (HTTP ${response.status}).` };
    return { success: true, detail: "Connected to Twilio." };
  } catch (err) {
    return handleError(err);
  }
}

export async function testStorageConnectionAction(
  _prevState: TestConnectionState,
  _formData: FormData,
): Promise<TestConnectionState> {
  try {
    await requireSettingsAccess();
    const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    if (!bucketName) return { error: "GOOGLE_CLOUD_STORAGE_BUCKET is not set." };

    const { Storage } = await import("@google-cloud/storage");
    const storage = new Storage(projectId ? { projectId } : undefined);
    const [exists] = await storage.bucket(bucketName).exists();
    if (!exists) return { error: `Bucket "${bucketName}" does not exist or isn't accessible.` };
    return { success: true, detail: `Connected — bucket "${bucketName}" exists and is accessible.` };
  } catch (err) {
    return handleError(err);
  }
}
