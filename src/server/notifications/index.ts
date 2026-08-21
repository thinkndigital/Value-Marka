import "server-only";
import type { EmailProvider, SmsProvider } from "./provider";
import { smtpEmailProvider } from "./smtp";
import { resendEmailProvider } from "./resend";
import { twilioSmsProvider } from "./twilio";
import { messagebirdSmsProvider } from "./messagebird";

export function getEmailProvider(): EmailProvider {
  const configured = process.env.EMAIL_PROVIDER ?? "smtp";
  // sendgrid/mailgun are documented in .env.example as valid EMAIL_PROVIDER
  // values but don't have adapters yet — resend and smtp cover the same
  // "any SMTP-speaking or transactional-HTTP-API" surface for now; add a
  // sendgrid.ts/mailgun.ts adapter here when one is actually needed.
  return configured === "resend" ? resendEmailProvider : smtpEmailProvider;
}

export function getSmsProvider(): SmsProvider {
  const configured = process.env.SMS_PROVIDER ?? "twilio";
  return configured === "messagebird" ? messagebirdSmsProvider : twilioSmsProvider;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
