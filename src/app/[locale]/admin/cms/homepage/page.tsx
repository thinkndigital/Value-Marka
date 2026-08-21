import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { HeroForm } from "@/components/admin/HeroForm";
import { LimitForm } from "@/components/admin/LimitForm";
import { BannerForm } from "@/components/admin/BannerForm";
import { FormActionButton } from "@/components/admin/FormActionButton";
import { DeleteButton } from "@/components/admin/DeleteButton";
import {
  getHeroBlockRaw,
  getLimitBlockRaw,
  listBannersForAdmin,
  type BannerContent,
} from "@/server/services/cms";
import {
  updateHeroAction,
  updateLimitAction,
  createBannerAction,
  updateBannerAction,
  toggleBannerAction,
  reorderBannerAction,
  deleteBannerAction,
} from "@/server/cms/actions";

const DEFAULT_HERO = {
  kicker: "",
  title: "",
  subtitle: "",
  ctaPrimaryLabel: "",
  ctaPrimaryHref: "",
  ctaSecondaryLabel: "",
  ctaSecondaryHref: "",
};

export default async function AdminHomepagePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ editLocale?: string }>;
}) {
  const { locale } = await params;
  const { editLocale: requestedLocale } = await searchParams;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "cms.read"))) {
    return <Forbidden />;
  }
  const canUpdate = await hasPermission(user.id, "cms.update");

  const editLocale = routing.locales.includes(requestedLocale as (typeof routing.locales)[number])
    ? (requestedLocale as string)
    : locale;

  const [hero, categoryLimit, productLimit, banners] = await Promise.all([
    getHeroBlockRaw(editLocale),
    getLimitBlockRaw("homepage.featured_categories", editLocale),
    getLimitBlockRaw("homepage.featured_products", editLocale),
    listBannersForAdmin(editLocale),
  ]);

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text-primary">Homepage builder</h1>
        <div className="flex gap-2">
          {routing.locales.map((l) => (
            <Link
              key={l}
              href={{ pathname: "/admin/cms/homepage", query: { editLocale: l } }}
              className={`vm-focus-ring rounded-md border px-3 py-1.5 text-sm font-medium ${
                l === editLocale
                  ? "border-navy-600 bg-navy-600 text-white"
                  : "border-border-default text-text-secondary hover:bg-bg-sunken"
              }`}
            >
              {l.toUpperCase()}
            </Link>
          ))}
        </div>
      </div>

      {!canUpdate ? (
        <p className="text-sm text-text-muted">You have read-only access to this content.</p>
      ) : null}

      <Card>
        <CardBody className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-bold text-text-primary">Hero section</h2>
          {canUpdate ? (
            <HeroForm action={updateHeroAction.bind(null, editLocale)} initial={hero ?? DEFAULT_HERO} />
          ) : (
            <p className="text-sm text-text-secondary">{hero?.title ?? "No hero content yet."}</p>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardBody>
            <h2 className="mb-3 font-display text-lg font-bold text-text-primary">
              Featured categories
            </h2>
            {canUpdate ? (
              <LimitForm
                action={updateLimitAction.bind(null, "homepage.featured_categories", editLocale)}
                label="How many to show"
                initial={categoryLimit ?? 8}
              />
            ) : (
              <p className="text-sm text-text-secondary">{categoryLimit ?? 8} shown</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <h2 className="mb-3 font-display text-lg font-bold text-text-primary">
              Featured products
            </h2>
            {canUpdate ? (
              <LimitForm
                action={updateLimitAction.bind(null, "homepage.featured_products", editLocale)}
                label="How many to show"
                initial={productLimit ?? 8}
              />
            ) : (
              <p className="text-sm text-text-secondary">{productLimit ?? 8} shown</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-bold text-text-primary">Banners</h2>

          {banners.length === 0 ? (
            <p className="text-sm text-text-muted">No banners yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {banners.map((banner) => {
                const content = banner.content as unknown as BannerContent;
                return (
                  <div key={banner.id} className="rounded-lg border border-border-default p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary">{content.headline}</span>
                        <Badge variant={banner.isActive ? "success" : "neutral"}>
                          {banner.isActive ? "Active" : "Hidden"}
                        </Badge>
                      </div>
                      {canUpdate ? (
                        <div className="flex gap-2">
                          <FormActionButton
                            action={reorderBannerAction.bind(null, banner.id, "up")}
                            label="↑"
                          />
                          <FormActionButton
                            action={reorderBannerAction.bind(null, banner.id, "down")}
                            label="↓"
                          />
                          <FormActionButton
                            action={toggleBannerAction.bind(null, banner.id)}
                            label={banner.isActive ? "Hide" : "Show"}
                          />
                          <DeleteButton
                            action={deleteBannerAction.bind(null, banner.id)}
                            confirmMessage="Delete this banner?"
                          />
                        </div>
                      ) : null}
                    </div>
                    {canUpdate ? (
                      <BannerForm
                        action={updateBannerAction.bind(null, banner.id)}
                        initial={content}
                        submitLabel="Save banner"
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {canUpdate ? (
            <div className="border-t border-border-default pt-4">
              <h3 className="mb-3 font-display text-sm font-bold text-text-primary">Add a banner</h3>
              <BannerForm action={createBannerAction.bind(null, editLocale)} />
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
