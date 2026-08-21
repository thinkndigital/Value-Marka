import "server-only";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SmsMessage {
  to: string;
  body: string;
}

export interface EmailProvider {
  sendEmail(message: EmailMessage): Promise<void>;
}

export interface SmsProvider {
  sendSms(message: SmsMessage): Promise<void>;
}

export class NotificationProviderError extends Error {}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new NotificationProviderError(`${name} is not configured — see .env.example.`);
  return value;
}

export { requireEnv };
