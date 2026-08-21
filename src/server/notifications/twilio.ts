import "server-only";
import type { SmsProvider, SmsMessage } from "./provider";
import { requireEnv, NotificationProviderError } from "./provider";

export const twilioSmsProvider: SmsProvider = {
  async sendSms(message: SmsMessage) {
    const accountSid = requireEnv("SMS_API_KEY");
    const authToken = requireEnv("SMS_API_SECRET");
    const from = requireEnv("SMS_FROM_NUMBER");

    const body = new URLSearchParams({ To: message.to, From: from, Body: message.body });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new NotificationProviderError(`Twilio API error (${response.status}): ${errorBody}`);
    }
  },
};
