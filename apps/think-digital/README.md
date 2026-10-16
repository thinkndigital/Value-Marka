# Think Digital — فكر رقمياً (web)

Standalone Next.js 16 app for the new Think Digital site, living in the Value
Marka repo but sharing nothing with it at build or run time. Plan and audit:
[`docs/think-digital/PHASE-1-AUDIT-AND-ARCHITECTURE.md`](../../docs/think-digital/PHASE-1-AUDIT-AND-ARCHITECTURE.md).

Stack: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
next-intl (Arabic default/RTL, English/LTR) · lucide-react.

```bash
cd apps/think-digital
npm install --legacy-peer-deps   # npm 10 crashes resolving vitest's optional jsdom/canvas peers otherwise
npm run dev                      # http://localhost:3000 → /ar
npm run typecheck && npm run lint && npm test && npm run build
```

`/[locale]/style-guide` renders the whole design system (noindex).

## Design system (Phase 3)

| Layer | Where |
|---|---|
| Tokens — colour roles, `.surface-inverse` / `.surface-brand` | `src/styles/tokens/color.css` |
| Tokens — type scale, RTL leading/tracking | `src/styles/tokens/type.css` |
| Tokens — layout rhythm, gutters, z-index, hit target | `src/styles/tokens/space.css` |
| Tokens — durations, easings, `--dir`, reduced motion | `src/styles/tokens/motion.css` |
| Tailwind mapping (`bg-bg`, `text-fg`, `text-h1`, `rounded-md`…) + utilities | `src/app/globals.css` |
| Fonts (`next/font`, self-hosted) | `src/app/fonts.ts` |
| Primitives | `src/components/ui/*` — Button, Field/Input/Textarea/Select/Checkbox, Badge/NewBadge/Tag, Card, Alert/Skeleton/EmptyState, Accordion, Dialog, Tooltip, Tabs |
| Composites | `components/sections/*` (SectionHeader, TestimonialCard, PricingCard, StatItem), `components/services/ServiceCard`, `components/portfolio/ProjectCard`, `components/navigation/*` |

Rules:
- Components read **semantic roles only** (`--fg`, `--primary`…), never ramps,
  so a dark section is just `className="surface-inverse"`.
- Horizontal motion is multiplied by `--dir` (−1 in RTL); arrows use `flip-rtl`.
  Numbers, emails and code use `ltr-island`.
- `tests/tokens.contrast.test.ts` enforces WCAG 2.2 AA on every role pair.

## Provisional / NEEDS SOURCE

- **Brand colours and typefaces** are provisional. To apply the real identity,
  edit the `--brand-*` / `--tech-*` ramps in `color.css` and the families in
  `fonts.ts`, then run `npm test` (the contrast test flags any pair that breaks).
- **Logo**: `components/navigation/Wordmark.tsx` and `src/app/icon.svg` are
  typographic placeholders.
- `src/data/site.ts` holds only facts verified in the Phase 1 audit; missing
  facts are `{ value: null, todo: "NEEDS SOURCE" }` and must not be rendered.
