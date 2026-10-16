export type Locale = "ar" | "en";
export type L10n<T = string> = Record<Locale, T>;

/** A fact with provenance, or an explicit gap the UI must hide. */
export type Sourced<T> = { value: T; source: string } | { value: null; todo: "NEEDS SOURCE" };

export function hasValue<T>(s: Sourced<T>): s is { value: T; source: string } {
  return s.value !== null;
}
