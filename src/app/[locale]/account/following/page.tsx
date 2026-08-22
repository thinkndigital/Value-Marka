import { Link } from "@/i18n/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireUser } from "@/server/auth/guards";
import { listFollowedSellersForUser } from "@/server/services/sellerFollow";

export default async function FollowingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);
  const followed = await listFollowedSellersForUser(user.id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold text-text-primary">Following</h1>

      {followed.length === 0 ? (
        <EmptyState
          title="You're not following any sellers yet"
          description="Follow a seller from their store page to see new products from them here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {followed.map(({ seller, followedAt }) => (
            <Link key={seller.storeSlug} href={`/store/${seller.storeSlug}`}>
              <Card className="hover:bg-bg-sunken">
                <CardBody className="flex items-center gap-4">
                  {seller.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={seller.logoUrl}
                      alt=""
                      className="h-12 w-12 rounded-md border border-border-default object-cover"
                    />
                  ) : null}
                  <div className="flex-1">
                    <p className="font-display font-semibold text-text-primary">{seller.storeName}</p>
                    <p className="text-sm text-text-muted">
                      {seller._count.products} products · {seller._count.followers} followers
                    </p>
                  </div>
                  <p className="text-xs text-text-muted">
                    Following since{" "}
                    {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(followedAt)}
                  </p>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
