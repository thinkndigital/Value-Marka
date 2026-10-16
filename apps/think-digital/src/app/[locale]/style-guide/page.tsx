import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Bot, Megaphone, Palette, Share2, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/Field";
import { Badge, NewBadge, Tag } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Alert, EmptyState, Skeleton } from "@/components/ui/Feedback";
import { Accordion } from "@/components/ui/Accordion";
import { Dialog } from "@/components/ui/Dialog";
import { Tooltip } from "@/components/ui/Tooltip";
import { Tabs } from "@/components/ui/Tabs";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { PricingCard, TestimonialCard } from "@/components/sections/ContentCards";
import { ServiceCard, ServiceGrid } from "@/components/services/ServiceCard";
import { ProjectCard } from "@/components/portfolio/ProjectCard";
import { Wordmark } from "@/components/navigation/Wordmark";
import { LanguageSwitcher } from "@/components/navigation/LanguageSwitcher";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "StyleGuide" });
  // Internal reference page: never indexed.
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

const COLOR_ROLES = [
  ["--bg", "bg"],
  ["--bg-elevated", "bg-elevated"],
  ["--bg-sunken", "bg-sunken"],
  ["--fg", "fg"],
  ["--fg-muted", "fg-muted"],
  ["--border", "line"],
  ["--primary", "primary"],
  ["--accent-text", "accent"],
  ["--tech", "tech"],
  ["--inverse-bg", "inverse-bg"],
  ["--success", "success"],
  ["--warning", "warning"],
  ["--danger", "danger"],
  ["--info", "info"],
] as const;

const TYPE_SCALE = [
  ["text-display", "--fs-display"],
  ["text-h1", "--fs-h1"],
  ["text-h2", "--fs-h2"],
  ["text-h3", "--fs-h3"],
  ["text-h4", "--fs-h4"],
  ["text-body-lg", "--fs-body-lg"],
  ["text-body", "--fs-body"],
] as const;

const SPACING = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32];
const RADII = ["rounded-xs", "rounded-sm", "rounded-md", "rounded-lg", "rounded-pill"];
const SHADOWS = ["shadow-sm", "shadow-md", "shadow-overlay"];
const DURATIONS = ["--duration-instant", "--duration-fast", "--duration-normal", "--duration-slow", "--duration-slower"];
const EASINGS = ["--ease-standard", "--ease-emphasized", "--ease-enter", "--ease-exit"];
const BREAKPOINTS = [
  ["xs", "480px"],
  ["sm", "640px"],
  ["md", "768px"],
  ["lg", "1024px"],
  ["xl", "1280px"],
  ["2xl", "1536px"],
];

function Section({ id, index, title, children }: { id: string; index: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex flex-col gap-8 border-t border-line py-16">
      <h2 id={`${id}-title`} className="flex items-baseline gap-4 text-h2">
        <span className="ltr-island eyebrow text-accent">{index}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="ltr-island rounded-xs bg-bg-sunken px-1.5 py-0.5 font-mono text-xs">{children}</code>;
}

export default async function StyleGuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("StyleGuide");
  const common = await getTranslations("Common");
  const s = (k: string) => t(`sections.${k}`);
  const arrow = <ArrowRight className="flip-rtl size-4" />;

  const nav = [
    "colors",
    "typography",
    "spacing",
    "radius",
    "motion",
    "buttons",
    "forms",
    "badges",
    "cards",
    "services",
    "projects",
    "content",
    "faq",
    "overlays",
    "feedback",
    "surfaces",
    "responsive",
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-[var(--z-header)] border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="container-site flex h-[var(--header-h)] items-center justify-between gap-4">
          <Wordmark label={common("home")} />
          <LanguageSwitcher />
        </div>
      </header>

      <main id="main" className="container-site pb-24">
        <div className="flex flex-col gap-6 py-16 md:py-24">
          <SectionHeader as="h1" eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
          <Alert tone="warning">{t("provisional")}</Alert>
          <nav aria-label={t("title")}>
            <ul className="flex flex-wrap gap-2">
              {nav.map((k, i) => (
                <li key={k}>
                  <a
                    href={`#${k}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-line px-4 text-sm hover:border-fg"
                  >
                    <span className="ltr-island text-fg-muted">{String(i + 1).padStart(2, "0")}</span>
                    {s(k)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <Section id="colors" index="01" title={s("colors")}>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
            {COLOR_ROLES.map(([cssVar, util]) => (
              <li key={cssVar} className="flex flex-col gap-2">
                <span className="h-20 rounded-sm border border-line" style={{ background: `var(${cssVar})` }} />
                <Code>{util}</Code>
                <span className="ltr-island text-xs text-fg-muted">{cssVar}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="typography" index="02" title={s("typography")}>
          <div className="flex flex-col divide-y divide-line">
            {TYPE_SCALE.map(([cls, token]) => (
              <div key={cls} className="grid gap-2 py-6 md:grid-cols-[12rem_1fr] md:items-baseline">
                <div className="flex flex-col gap-1">
                  <Code>{cls}</Code>
                  <span className="ltr-island text-xs text-fg-muted">{token}</span>
                </div>
                <p className={cls === "text-body" || cls === "text-body-lg" ? cls : `${cls} font-display font-bold`}>
                  {cls.startsWith("text-body") ? t("bodySample") : t("typeSample")}
                </p>
              </div>
            ))}
          </div>
          <p className="eyebrow">eyebrow · {t("eyebrow")}</p>
        </Section>

        <Section id="spacing" index="03" title={s("spacing")}>
          <ul className="flex flex-col gap-3">
            {SPACING.map((n) => (
              <li key={n} className="flex items-center gap-4">
                <span className="ltr-island w-24 text-sm text-fg-muted">
                  {n} · {n * 4}px
                </span>
                <span className="h-4 rounded-xs bg-primary" style={{ width: `${n * 4}px` }} />
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-4 gap-[var(--gutter)] md:grid-cols-12" aria-hidden>
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className={`h-16 rounded-xs bg-primary-soft ${i >= 4 ? "hidden md:block" : ""}`} />
            ))}
          </div>
          {/* Token reference line: force LTR so the bidi algorithm doesn't reorder it inside Arabic. */}
          <p dir="ltr" className="text-sm text-fg-muted">
            <Code>container-site</Code> 1280px · <Code>container-wide</Code> 1440px · <Code>container-prose</Code> 72ch ·{" "}
            <Code>--gutter</Code> 16→32px · <Code>section-y</Code> 64→144px
          </p>
        </Section>

        <Section id="radius" index="04" title={s("radius")}>
          <div className="flex flex-wrap gap-6">
            {RADII.map((r) => (
              <div key={r} className="flex flex-col items-center gap-2">
                <span className={`size-24 border border-line-strong bg-bg-elevated ${r}`} />
                <Code>{r}</Code>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-6">
            {SHADOWS.map((sh) => (
              <div key={sh} className="flex flex-col items-center gap-2">
                <span className={`size-24 rounded-md bg-bg-elevated ${sh}`} />
                <Code>{sh}</Code>
              </div>
            ))}
          </div>
        </Section>

        <Section id="motion" index="05" title={s("motion")}>
          <p className="text-fg-muted">{t("motionHint")}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <ul className="flex flex-col gap-2">
              {DURATIONS.map((d) => (
                <li key={d}>
                  <button
                    type="button"
                    className="group flex w-full min-h-12 items-center gap-4 rounded-sm border border-line bg-bg-elevated px-4 text-start"
                  >
                    <span className="ltr-island w-44 text-sm">{d}</span>
                    <span className="relative h-2 flex-1 overflow-hidden rounded-pill bg-bg-sunken">
                      <span
                        className="absolute inset-y-0 start-0 w-1/4 rounded-pill bg-primary transition-[inset-inline-start] group-hover:start-3/4 group-focus-visible:start-3/4"
                        style={{ transitionDuration: `var(${d})`, transitionTimingFunction: "var(--ease-standard)" }}
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <ul className="flex flex-col gap-2">
              {EASINGS.map((e) => (
                <li key={e}>
                  <button
                    type="button"
                    className="group flex w-full min-h-12 items-center gap-4 rounded-sm border border-line bg-bg-elevated px-4 text-start"
                  >
                    <span className="ltr-island w-44 text-sm">{e}</span>
                    <span className="relative h-2 flex-1 overflow-hidden rounded-pill bg-bg-sunken">
                      <span
                        className="absolute inset-y-0 start-0 w-1/4 rounded-pill bg-tech transition-[inset-inline-start] group-hover:start-3/4 group-focus-visible:start-3/4"
                        style={{ transitionDuration: "var(--duration-slower)", transitionTimingFunction: `var(${e})` }}
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section id="buttons" index="06" title={s("buttons")}>
          <div className="flex flex-wrap items-center gap-3">
            <Button icon={arrow}>{t("buttons.primary")}</Button>
            <Button variant="secondary">{t("buttons.secondary")}</Button>
            <Button variant="tech" icon={arrow}>
              {t("buttons.tech")}
            </Button>
            <Button variant="outline">{t("buttons.outline")}</Button>
            <Button variant="ghost">{t("buttons.ghost")}</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">{t("buttons.primary")}</Button>
            <Button size="md">{t("buttons.primary")}</Button>
            <Button size="lg" icon={arrow}>
              {t("buttons.primary")}
            </Button>
            <Button loading>{t("buttons.loading")}</Button>
            <Button variant="outline" disabled>
              {t("buttons.disabled")}
            </Button>
          </div>
        </Section>

        <Section id="forms" index="07" title={s("forms")}>
          <form className="grid max-w-3xl gap-6 md:grid-cols-2" action="#" noValidate>
            <Field name="sg-name" label={t("form.name")} required requiredLabel={common("required")}>
              {(a) => <Input {...a} name="name" autoComplete="name" required />}
            </Field>
            <Field
              name="sg-email"
              label={t("form.email")}
              hint={t("form.emailHint")}
              error={t("form.emailError")}
              required
              requiredLabel={common("required")}
            >
              {(a) => <Input {...a} name="email" type="email" dir="ltr" autoComplete="email" defaultValue="name@" required />}
            </Field>
            <Field name="sg-service" label={t("form.service")}>
              {(a) => (
                <Select {...a} name="service" defaultValue="">
                  <option value="" disabled>
                    {t("form.servicePlaceholder")}
                  </option>
                  <option>{t("services.marketing.title")}</option>
                  <option>{t("services.branding.title")}</option>
                  <option>{t("services.webapps.title")}</option>
                </Select>
              )}
            </Field>
            <div className="md:col-span-2">
              <Field name="sg-message" label={t("form.message")}>
                {(a) => <Textarea {...a} name="message" />}
              </Field>
            </div>
            <Checkbox name="sg-consent" label={t("form.consent")} />
          </form>
        </Section>

        <Section id="badges" index="08" title={s("badges")}>
          <div className="flex flex-wrap items-center gap-3">
            {(["neutral", "brand", "tech", "success", "warning", "danger", "inverse"] as const).map((tone) => (
              <Badge key={tone} tone={tone}>
                {tone}
              </Badge>
            ))}
            <NewBadge label={t("feedback.new")} detail={t("feedback.newDetail")} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Tag>Next.js</Tag>
            <Tag>SEO</Tag>
            <Tag>{t("services.branding.title")}</Tag>
          </div>
        </Section>

        <Section id="cards" index="09" title={s("cards")}>
          <div className="grid gap-4 md:grid-cols-4">
            {(["outline", "plain", "sunken", "inverse"] as const).map((v) => (
              <Card key={v} variant={v} className="flex min-h-40 flex-col justify-end gap-2">
                <Code>{v}</Code>
                <p className="text-sm text-fg-muted">{t("surfaces.body")}</p>
              </Card>
            ))}
          </div>
        </Section>

        <Section id="services" index="10" title={s("services")}>
          <p className="text-sm text-fg-muted">{t("motionHint")}</p>
          <ServiceGrid>
            <ServiceCard
              number="01"
              href="/style-guide#services"
              icon={<Megaphone aria-hidden />}
              title={t("services.marketing.title")}
              description={t("services.marketing.text")}
            />
            <ServiceCard
              number="02"
              href="/style-guide#services"
              icon={<Share2 aria-hidden />}
              title={t("services.social.title")}
              description={t("services.social.text")}
            />
            <ServiceCard
              number="03"
              href="/style-guide#services"
              icon={<Palette aria-hidden />}
              title={t("services.branding.title")}
              description={t("services.branding.text")}
            />
            <ServiceCard
              number="04"
              tone="tech"
              href="/style-guide#services"
              icon={<Bot aria-hidden />}
              title={t("services.webapps.title")}
              description={t("services.webapps.text")}
            />
          </ServiceGrid>
        </Section>

        <Section id="projects" index="11" title={s("projects")}>
          <Badge tone="warning">{t("sample")}</Badge>
          <div className="grid gap-10 md:grid-cols-2">
            {[1, 2].map((n) => (
              <ProjectCard
                key={n}
                href="/style-guide#projects"
                title={`${t("project.title")} ${n}`}
                client={t("project.client")}
                industry={t("project.industry")}
                services={[t("services.branding.title"), t("services.webapps.title")]}
                summary={t("project.summary")}
                placeholderLabel={t("project.placeholder")}
              />
            ))}
          </div>
        </Section>

        <Section id="content" index="12" title={s("content")}>
          <Badge tone="warning">{t("sample")}</Badge>
          <div className="grid gap-6 lg:grid-cols-3">
            <TestimonialCard quote={t("testimonial.quote")} author={t("testimonial.author")} role={t("testimonial.role")} />
            <PricingCard
              name={t("pricing.name")}
              price={t("pricing.price")}
              priceNote={t("pricing.note")}
              features={[t("pricing.feature"), t("pricing.feature")]}
              cta={{ label: t("pricing.cta"), href: "/style-guide#content" }}
            />
            <PricingCard
              featured
              featuredLabel={t("pricing.featured")}
              name={t("pricing.name")}
              price={t("pricing.price")}
              priceNote={t("pricing.note")}
              features={[t("pricing.feature"), t("pricing.feature"), t("pricing.feature")]}
              cta={{ label: t("pricing.cta"), href: "/style-guide#content" }}
            />
          </div>
        </Section>

        <Section id="faq" index="13" title={s("faq")}>
          <Accordion
            name="sg-faq"
            defaultOpenId="sg-faq-1"
            items={[
              { id: "sg-faq-1", title: t("faq.q1"), content: <p>{t("faq.a1")}</p> },
              { id: "sg-faq-2", title: t("faq.q2"), content: <p>{t("faq.a2")}</p> },
            ]}
          />
          <p className="text-xs text-fg-muted">{t("faq.source")}</p>
        </Section>

        <Section id="overlays" index="14" title={s("overlays")}>
          <div className="flex flex-wrap items-center gap-4">
            <Dialog
              triggerLabel={t("overlays.dialogOpen")}
              title={t("overlays.dialogTitle")}
              description={t("overlays.dialogBody")}
              closeLabel={common("close")}
            >
              <div className="flex justify-end">
                <Button href="/style-guide#overlays">{t("buttons.secondary")}</Button>
              </div>
            </Dialog>
            <Tooltip content={t("overlays.tooltip")}>
              <button
                type="button"
                className="hit-target inline-flex items-center gap-2 rounded-pill border border-line px-4 text-sm"
              >
                <Info aria-hidden className="size-4" />
                {t("overlays.tooltipTrigger")}
              </button>
            </Tooltip>
          </div>
          <Tabs
            label={t("overlays.tabsLabel")}
            items={[
              { id: "growth", label: t("overlays.tabGrowth"), content: <p>{t("overlays.tabGrowthBody")}</p> },
              { id: "creative", label: t("overlays.tabCreative"), content: <p>{t("overlays.tabCreativeBody")}</p> },
              { id: "tech", label: t("overlays.tabTech"), content: <p>{t("overlays.tabTechBody")}</p> },
            ]}
          />
        </Section>

        <Section id="feedback" index="15" title={s("feedback")}>
          <div className="grid gap-4 md:grid-cols-2">
            <Alert tone="success" title={t("feedback.success")}>
              {t("feedback.successBody")}
            </Alert>
            <Alert tone="danger" title={t("feedback.error")}>
              {t("feedback.errorBody")}
            </Alert>
            <Alert tone="info" title={t("feedback.info")}>
              {t("feedback.infoBody")}
            </Alert>
            <Alert tone="warning" title={t("feedback.warning")}>
              {t("feedback.warningBody")}
            </Alert>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <EmptyState
              title={t("feedback.emptyTitle")}
              description={t("feedback.emptyBody")}
              action={<Button variant="outline" size="sm">{t("feedback.emptyAction")}</Button>}
            />
            <div className="flex flex-col gap-3" aria-hidden>
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </Section>

        <Section id="surfaces" index="16" title={s("surfaces")}>
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              ["", t("surfaces.default")],
              ["surface-inverse", t("surfaces.inverse")],
              ["surface-brand", t("surfaces.brand")],
            ].map(([cls, label]) => (
              <div key={label} className={`flex flex-col gap-4 rounded-lg border border-line p-8 ${cls}`}>
                <p className="eyebrow">{label}</p>
                <p className="text-h3 font-display font-bold">{t("typeSample")}</p>
                <p className="text-sm text-fg-muted">{t("surfaces.body")}</p>
                <div className="flex flex-wrap gap-3">
                  <Button variant={cls === "surface-brand" ? "secondary" : "primary"} size="sm" icon={arrow}>
                    {t("buttons.primary")}
                  </Button>
                  <Button variant="outline" size="sm">
                    {t("buttons.outline")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="responsive" index="17" title={s("responsive")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-md text-start text-sm">
              <thead className="text-fg-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="py-3 text-start font-semibold">
                    Breakpoint
                  </th>
                  <th scope="col" className="py-3 text-start font-semibold">
                    min-width
                  </th>
                </tr>
              </thead>
              <tbody>
                {BREAKPOINTS.map(([name, px]) => (
                  <tr key={name} className="border-b border-line">
                    <td className="py-3">
                      <Code>{name}</Code>
                    </td>
                    <td className="ltr-island py-3">{px}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="ltr-island grid gap-2 text-sm text-fg-muted md:grid-cols-2" dir="ltr">
            <li>QA widths: 320 · 375 · 390 · 430 · 768 · 1024 · 1280 · 1440 · 1920</li>
            <li>Touch targets ≥ 44px (--hit-min, pointer-coarse)</li>
            <li>Hover reveals become always-visible on touch (pointer-fine only)</li>
            <li>Parallax / horizontal scenes disabled &lt; 768px (Phase 4)</li>
          </ul>
        </Section>
      </main>
    </div>
  );
}
