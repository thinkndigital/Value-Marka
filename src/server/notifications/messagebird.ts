import "server-only";
import type { SmsProvider, SmsMessage } from "./provider";
import { requireEnv, NotificationProviderError } from "./provider";

export const messagebirdSmsProvider: SmsProvider = {
  async sendSms(message: SmsMessage) {
    const response = await fetch("https://rest.messagebird.com/messages", {
      method: "POST",
      headers: {
        Authorization: `AccessKey ${requireEnv("SMS_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        originator: requireEnv("SMS_FROM_NUMBER"),
        recipients: [message.to],
        body: message.body,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new NotificationProviderError(`MessageBird API error (${response.status}): ${errorBody}`);
    }
  },
};
