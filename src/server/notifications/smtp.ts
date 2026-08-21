import "server-only";
import nodemailer from "nodemailer";
import type { EmailProvider, EmailMessage } from "./provider";
import { requireEnv } from "./provider";

let transport: nodemailer.Transporter | null = null;

function getTransport() {
  if (transport) return transport;
  transport = nodemailer.createTransport({
    host: requireEnv("SMTP_HOST"),
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user: requireEnv("SMTP_USER"), pass: requireEnv("SMTP_PASSWORD") },
  });
  return transport;
}

export const smtpEmailProvider: EmailProvider = {
  async sendEmail(message: EmailMessage) {
    await getTransport().sendMail({
      from: process.env.EMAIL_FROM ?? "Value Marka <no-reply@example.com>",
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  },
};
