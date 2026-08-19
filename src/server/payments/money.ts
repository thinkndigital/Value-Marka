import "server-only";

/** Stripe (and most gateway APIs) want amounts as an integer in the currency's smallest unit. */
export function toMinorUnits(amount: number, decimalDigits: number): number {
  return Math.round(amount * 10 ** decimalDigits);
}

export function fromMinorUnits(minorUnits: number, decimalDigits: number): number {
  return minorUnits / 10 ** decimalDigits;
}

/** PayPal wants a fixed-decimal string ("49.99"), not minor units. */
export function toDecimalString(amount: number, decimalDigits: number): string {
  return amount.toFixed(decimalDigits);
}
