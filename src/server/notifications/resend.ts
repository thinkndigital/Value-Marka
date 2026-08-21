import "server-only";
import type { EmailProvider, EmailMessage } from "./provider";
import { requireEnv, NotificationProviderError } from "./provider";

export const resendEmailProvider: EmailProvider = {
  async sendEmail(message: EmailMessage) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireEnv("EMAIL_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Value Marka <no-reply@example.com>",
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new NotificationProviderError(`Resend API error (${response.status}): ${body}`);
    }
  },
};
