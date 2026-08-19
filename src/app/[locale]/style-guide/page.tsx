import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

// Tailwind's scanner needs full, literal class strings — no
// `` `bg-${token}` `` interpolation — so each swatch names its class here.
const colorGroups: { label: string; swatches: { name: string; bg: string }[] }[] = [
  {
    label: "Navy",
    swatches: [
      { name: "navy-50", bg: "bg-navy-50" },
      { name: "navy-100", bg: "bg-navy-100" },
      { name: "navy-200", bg: "bg-navy-200" },
      { name: "navy-300", bg: "bg-navy-300" },
      { name: "navy-400", bg: "bg-navy-400" },
      { name: "navy-500", bg: "bg-navy-500" },
      { name: "navy-600", bg: "bg-navy-600" },
      { name: "navy-700", bg: "bg-navy-700" },
      { name: "navy-800", bg: "bg-navy-800" },
      { name: "navy-900", bg: "bg-navy-900" },
    ],
  },
  {
    label: "Yellow",
    swatches: [
      { name: "yellow-50", bg: "bg-yellow-50" },
      { name: "yellow-100", bg: "bg-yellow-100" },
      { name: "yellow-200", bg: "bg-yellow-200" },
      { name: "yellow-300", bg: "bg-yellow-300" },
      { name: "yellow-400", bg: "bg-yellow-400" },
      { name: "yellow-500", bg: "bg-yellow-500" },
      { name: "yellow-600", bg: "bg-yellow-600" },
    ],
  },
];

const semanticSwatches = [
  { label: "Success", bg: "bg-success-bg", text: "text-success" },
  { label: "Danger", bg: "bg-danger-bg", text: "text-danger" },
  { label: "Warning", bg: "bg-warning-bg", text: "text-warning" },
  { label: "Info", bg: "bg-info-bg", text: "text-info" },
];

export default function StyleGuidePage() {
  return (
    <div className="vm-container flex flex-col gap-16 py-16">
      <header className="flex flex-col gap-3">
        <Logo />
        <h1 className="font-display text-3xl font-bold text-text-primary">
          Value Marka design system
        </h1>
        <p className="max-w-2xl text-text-secondary">
          Live rendering of the design tokens and primitives in
          <code className="mx-1 rounded bg-bg-sunken px-1.5 py-0.5 text-sm">
            src/components/ui
          </code>
          — the source of truth for every surface (customer, seller, admin).
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-bold">Color</h2>
        {colorGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-text-secondary">
              {group.label}
            </p>
            <div className="flex flex-wrap gap-3">
              {group.swatches.map((s) => (
                <div key={s.name} className="flex flex-col items-center gap-1.5">
                  <div
                    className={`h-14 w-14 rounded-md border border-border-default ${s.bg}`}
                  />
                  <span className="text-xs text-text-muted">{s.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-3">
          {semanticSwatches.map((s) => (
            <div
              key={s.label}
              className={`rounded-md ${s.bg} px-4 py-3 text-sm font-medium ${s.text}`}
            >
              {s.label}
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-bold">Typography</h2>
        <div className="flex flex-col gap-3">
          <p className="font-display text-4xl font-extrabold">
            Display / Cairo 4xl bold
          </p>
          <p className="font-display text-2xl font-bold">
            Display / Cairo 2xl bold
          </p>
          <p className="font-body text-base">
            Body / Tajawal base — used for paragraph copy across the
            storefront, seller dashboard and admin panel.
          </p>
          <p className="font-body text-sm text-text-secondary" dir="rtl">
            نص عربي تجريبي بخط Tajawal لعرض الاتجاه من اليمين إلى اليسار.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-bold">Buttons</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" loading>
            Loading
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="sm">
            Small
          </Button>
          <Button variant="primary" size="md">
            Medium
          </Button>
          <Button variant="primary" size="lg">
            Large
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-bold">Badges</h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral">Neutral</Badge>
          <Badge variant="brand">Brand</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="danger">Danger</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="info">Info</Badge>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-bold">Cards</h2>
        <Card className="max-w-sm">
          <CardHeader>
            <p className="font-display font-semibold">Card title</p>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-text-secondary">
              Cards are the base surface for dashboard widgets, product
              tiles and settings panels.
            </p>
          </CardBody>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-bold">Forms</h2>
        <div className="flex max-w-sm flex-col gap-4">
          <Input id="sg-email" label="Email" placeholder="you@example.com" />
          <Input
            id="sg-error"
            label="Email"
            defaultValue="not-an-email"
            error="Enter a valid email address."
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-bold">Alerts</h2>
        <div className="flex max-w-lg flex-col gap-3">
          <Alert variant="success">Payout approved successfully.</Alert>
          <Alert variant="danger">That coupon code has expired.</Alert>
          <Alert variant="warning">Low stock on 3 products.</Alert>
          <Alert variant="info">A new seller application is waiting.</Alert>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-bold">Loading &amp; empty states</h2>
        <div className="flex max-w-lg flex-col gap-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
        <EmptyState
          title="No products yet"
          description="Products you add will appear here."
          action={<Button variant="primary">Add product</Button>}
        />
      </section>
    </div>
  );
}
