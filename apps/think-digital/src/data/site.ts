import type { Sourced } from "./types";

// Only facts verified in the Phase 1 audit live here; everything else is an
// explicit NEEDS SOURCE entry that the UI must not render.
const INDEXED = "https://thinkndigital.com/ (search-index excerpt, Phase 1 audit)";

export const site = {
  name: { ar: "فكر رقمياً", en: "Think Digital" },
  email: { value: "info@thinkndigital.com", source: INDEXED } satisfies Sourced<string>,
  privacyEmail: { value: "privacy@thinkndigital.com", source: INDEXED } satisfies Sourced<string>,
  phone: { value: "+962799181518", source: INDEXED } satisfies Sourced<string>,
  whatsapp: { value: null, todo: "NEEDS SOURCE" } satisfies Sourced<string>,
  intro: {
    value: {
      ar: "فريق من خبراء التسويق الرقمي والتقنية والإنتاج الإبداعي، نعمل على تحويل الأفكار إلى نتائج قابلة للقياس.",
      en: "A team of digital marketing, technology and creative production experts turning ideas into measurable results.",
    },
    source: "https://thinkndigital.com/about/ (AR original; EN is our translation)",
  } satisfies Sourced<{ ar: string; en: string }>,
  social: [] as { network: string; url: string }[], // NEEDS SOURCE — never invent accounts
};
