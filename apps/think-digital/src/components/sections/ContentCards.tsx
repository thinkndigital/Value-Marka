import type { ReactNode } from "react";
import { Check, Quote } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";

/** Renders only real, attributed testimonials (data/testimonials.ts). */
export function TestimonialCard({
  quote,
  author,
  role,
  className,
}: {
  quote: ReactNode;
  author: ReactNode;
  role?: ReactNode;
  className?: string;
}) {
  return (
    <Card as="figure" className={cn("flex h-full flex-col justify-between gap-8", className)}>
      <Quote aria-hidden className="flip-rtl size-8 text-accent" />
      <blockquote className="font-display text-h4 font-medium leading-relaxed">{quote}</blockquote>
      <figcaption className="flex flex-col border-t border-line pt-4 text-sm">
        <span className="font-semibold">{author}</span>
        {role ? <span className="text-fg-muted">{role}</span> : null}
      </figcaption>
    </Card>
  );
}

/** Pricing/package tier. Prices must come from Think Digital — never invented. */
export function PricingCard({
  name,
  price,
  priceNote,
  description,
  features,
  cta,
  featured = false,
  featuredLabel,
  className,
}: {
  name: ReactNode;
  price: ReactNode;
  priceNote?: ReactNode;
  description?: ReactNode;
  features: ReactNode[];
  cta: { label: ReactNode; href: string };
  featured?: boolean;
  featuredLabel?: ReactNode;
  className?: string;
}) {
  return (
    <Card
      variant={featured ? "inverse" : "outline"}
      className={cn("flex h-full flex-col gap-6", featured && "border border-transparent", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-h4">{name}</h3>
        {featured && featuredLabel ? <Badge tone="brand">{featuredLabel}</Badge> : null}
      </div>
      <div>
        <p className="font-display text-h2">{price}</p>
        {priceNote ? <p className="text-sm text-fg-muted">{priceNote}</p> : null}
      </div>
      {description ? <p className="text-sm text-fg-muted">{description}</p> : null}
      <ul className="flex flex-1 flex-col gap-3 text-sm">
        {features.map((f, i) => (
          <li key={i} className="flex gap-3">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Button href={cta.href} variant={featured ? "primary" : "outline"} className="w-full">
        {cta.label}
      </Button>
    </Card>
  );
}

/** Shown only when every value is sourced (data/types.ts Sourced). */
export function StatItem({ value, label }: { value: string; label: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-line pt-4">
      <span className="ltr-island font-display text-h1">{value}</span>
      <span className="text-sm text-fg-muted">{label}</span>
    </div>
  );
}
