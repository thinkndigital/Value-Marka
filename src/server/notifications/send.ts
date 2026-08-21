import "server-only";
import { prisma } from "@/server/db";
import { registerJob, enqueue } from "@/server/jobs/queue";
import { getEmailProvider, getSmsProvider, stripHtml } from "./index";

registerJob("notification.send", async (payload) => {
  await prisma.notification.create({
    data: {
      userId: payload.userId,
      channel: payload.channel,
      type: payload.type,
      title: payload.title,
      body: payload.body,
    },
  });

  if (payload.channel === "EMAIL") {
    await getEmailProvider().sendEmail({
      to: payload.to,
      subject: payload.title,
      html: payload.body,
      text: stripHtml(payload.body),
    });
  } else if (payload.channel === "SMS") {
    await getSmsProvider().sendSms({ to: payload.to, body: stripHtml(payload.body) });
  }
});

/**
 * Every transactional-email trigger point in the app calls this — never
 * the provider directly — so sending always goes through the job queue
 * (ARCHITECTURE.md §10) and always leaves a `Notification` row behind.
 */
export function sendEmailNotification(input: {
  userId: string;
  to: string;
  type: string;
  subject: string;
  html: string;
}) {
  enqueue("notification.send", {
    userId: input.userId,
    channel: "EMAIL",
    type: input.type,
    title: input.subject,
    body: input.html,
    to: input.to,
  });
}

export function sendSmsNotification(input: { userId: string; to: string; type: string; body: string }) {
  enqueue("notification.send", {
    userId: input.userId,
    channel: "SMS",
    type: input.type,
    title: input.type,
    body: input.body,
    to: input.to,
  });
}
