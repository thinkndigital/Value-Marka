import "server-only";

/**
 * Provider-agnostic payment adapter (ARCHITECTURE.md §9). Checkout, refund,
 * and payout services call only this interface — never a provider SDK
 * directly — so a new gateway (HyperPay, Moyasar, Tap, …) is a pure adapter,
 * not a rewrite of the domain layer.
 *
 * Checkout always charges the platform's own account for the order total
 * (see ARCHITECTURE.md §9 for why a multi-seller cart can't use a single
 * per-seller "destination charge"); `transferToSeller` is the only method
 * that moves money into a seller's own connected account, called when a
 * `Payout` request is released.
 */
export interface PaymentProvider {
  readonly type: "STRIPE" | "PAYPAL";

  /** Starts a hosted checkout for the order's full grandTotal. */
  createIntent(input: CreateIntentInput): Promise<CreateIntentResult>;

  /**
   * Confirms a hosted checkout actually captured funds, for providers where
   * capture isn't implicit in the create step (PayPal: create → customer
   * approves → explicit capture call). Stripe Checkout Sessions capture on
   * completion, so the Stripe adapter's capture() just re-reads status.
   */
  capture(providerRef: string, currencyDecimalDigits: number): Promise<CaptureResult>;

  refund(input: RefundInput): Promise<RefundResult>;

  /** Starts the seller's connected-account onboarding (Stripe Express / PayPal Partner Referral). */
  onboardSeller(input: OnboardSellerInput): Promise<OnboardSellerResult>;

  /** Moves money out of the platform's balance into a seller's connected account, on payout release. */
  transferToSeller(input: TransferInput): Promise<TransferResult>;

  /** Verifies an inbound webhook's signature and normalizes it; throws on an invalid signature. */
  verifyWebhook(rawBody: string, headers: Record<string, string | undefined>): VerifiedWebhookEvent;
}

export interface CreateIntentInput {
  orderId: string;
  /** Major-unit decimal amount (e.g. 49.99), matching how Decimal columns read everywhere else in this codebase. */
  amount: number;
  currencyCode: string;
  /** From the Currency table — how many decimal places this currency uses (2 for USD, 3 for JOD/KWD/BHD/OMR, 0 for JPY-style). */
  currencyDecimalDigits: number;
  description?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateIntentResult {
  providerRef: string;
  redirectUrl: string;
}

export interface CaptureResult {
  providerRef: string;
  status: "CAPTURED" | "PENDING" | "FAILED";
  /** Major-unit decimal amount actually captured. */
  capturedAmount: number;
  rawPayload: unknown;
}

export interface RefundInput {
  providerRef: string;
  amount: number;
  currencyDecimalDigits: number;
  reason?: string;
}

export interface RefundResult {
  providerRef: string;
  amount: number;
}

export interface OnboardSellerInput {
  sellerId: string;
  email: string;
  countryCode: string;
  returnUrl: string;
  refreshUrl: string;
}

export interface OnboardSellerResult {
  accountId: string;
  onboardingUrl: string;
}

export interface TransferInput {
  accountId: string;
  amount: number;
  currencyCode: string;
  currencyDecimalDigits: number;
  referenceType: string;
  referenceId: string;
}

export interface TransferResult {
  providerRef: string;
}

export interface VerifiedWebhookEvent {
  eventId: string;
  type: string;
  data: unknown;
}

export class PaymentProviderError extends Error {}
