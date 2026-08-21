import "server-only";

interface Template {
  subject: string;
  html: string;
}

function layout(title: string, bodyHtml: string): string {
  return `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
    <h1 style="color:#1c2229; font-size: 20px;">${title}</h1>
    ${bodyHtml}
    <p style="color:#6b7280; font-size: 12px; margin-top: 32px;">Value Marka</p>
  </div>`;
}

export function welcomeEmail(firstName: string): Template {
  return {
    subject: "Welcome to Value Marka",
    html: layout(
      `Welcome, ${firstName}!`,
      `<p>Your account is ready. Browse thousands of sellers and start shopping, or apply to sell your own products on Value Marka.</p>`,
    ),
  };
}

export function orderConfirmationEmail(input: {
  orderNumber: string;
  items: { name: string; quantity: number }[];
  grandTotal: string;
  currencyCode: string;
}): Template {
  const itemsHtml = input.items
    .map((item) => `<li>${item.name} × ${item.quantity}</li>`)
    .join("");
  return {
    subject: `Order confirmed — ${input.orderNumber}`,
    html: layout(
      "Your order is confirmed",
      `<p>Order <strong>${input.orderNumber}</strong> has been placed.</p>
       <ul>${itemsHtml}</ul>
       <p>Total: <strong>${input.currencyCode} ${input.grandTotal}</strong></p>`,
    ),
  };
}

export function shipmentEmail(input: {
  orderNumber: string;
  storeName: string;
  carrier: string;
  trackingNumber: string;
}): Template {
  return {
    subject: `Your order from ${input.storeName} has shipped`,
    html: layout(
      "Your order is on its way",
      `<p>Order <strong>${input.orderNumber}</strong> from ${input.storeName} has shipped via ${input.carrier}.</p>
       <p>Tracking number: <strong>${input.trackingNumber}</strong></p>`,
    ),
  };
}

export function refundEmail(input: {
  orderNumber: string;
  storeName: string;
  amount: string;
  currencyCode: string;
}): Template {
  return {
    subject: `Refund processed — ${input.orderNumber}`,
    html: layout(
      "Your refund has been processed",
      `<p>${input.storeName} has refunded <strong>${input.currencyCode} ${input.amount}</strong> for order ${input.orderNumber}.</p>`,
    ),
  };
}

export function sellerApprovedEmail(storeName: string): Template {
  return {
    subject: "Your Value Marka seller application was approved",
    html: layout(
      "You're approved to sell",
      `<p>Congratulations — ${storeName} is now live on Value Marka. Sign in to your seller dashboard to start listing products.</p>`,
    ),
  };
}

export function sellerRejectedEmail(storeName: string, reason: string): Template {
  return {
    subject: "Your Value Marka seller application",
    html: layout(
      "Application update",
      `<p>We weren't able to approve ${storeName} at this time.</p><p>${reason}</p>`,
    ),
  };
}

export function payoutReleasedEmail(input: { amount: string; currencyCode: string; method: string }): Template {
  return {
    subject: "Your payout has been sent",
    html: layout(
      "Payout sent",
      `<p>${input.currencyCode} ${input.amount} has been sent to your ${input.method} account.</p>`,
    ),
  };
}

export function abandonedCartEmail(itemCount: number): Template {
  return {
    subject: "You left something in your cart",
    html: layout(
      "Still thinking it over?",
      `<p>You have ${itemCount} item${itemCount === 1 ? "" : "s"} waiting in your cart. Complete your order before it sells out.</p>`,
    ),
  };
}
