import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/server/db";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FollowSellerButton } from "@/components/FollowSellerButton";
import { getCurrentUser } from "@/server/auth/dal";
import { getSellerFollowerCount, isFollowingSeller } from "@/server/services/sellerFollow";

async function getStore(slug: string) {
  return prisma.seller.findFirst({
    where: { storeSlug: slug, status: "APPROVED" },
    include: {
      products: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        include: { images: { take: 1, orderBy: { sortOrder: "asc" } } },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const store = await getStore(slug);
  if (!store) return {};
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    title: `${store.storeName} — Value Marka`,
    description: store.description ?? undefined,
    alternates: { canonical: `${base}/${locale}/store/${slug}` },
  };
}

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getStore(slug);
  if (!store) notFound();

  const [user, followerCount] = await Promise.all([
    getCurrentUser(),
    getSellerFollowerCount(store.id),
  ]);
  const following = user ? await isFollowingSeller(user.id, store.id) : false;

  return (
    <div className="flex flex-col">
      <div
        className="border-b border-border-default bg-bg-surface"
        style={
          store.bannerUrl
            ? { backgroundImage: `url(${store.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
      >
        <div className="vm-container flex items-center gap-4 py-10">
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={store.logoUrl}
              alt=""
              className="h-16 w-16 rounded-lg border border-border-default bg-bg-surface object-cover"
            />
          ) : null}
          <div className="flex flex-1 flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-text-primary">
                {store.storeName}
              </h1>
              {store.description ? (
                <p className="max-w-xl text-sm text-text-secondary">{store.description}</p>
              ) : null}
              <p className="text-sm text-text-muted">
                {followerCount} {followerCount === 1 ? "follower" : "followers"}
              </p>
            </div>
            <FollowSellerButton
              sellerId={store.id}
              storeSlug={store.storeSlug}
              initialFollowing={following}
              signedIn={Boolean(user)}
            />
          </div>
        </div>
      </div>

      <div className="vm-container flex flex-col gap-6 py-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-text-primary">Products</h2>
          <Badge variant="neutral">{store.products.length} items</Badge>
        </div>

        {store.products.length === 0 ? (
          <EmptyState
            title="No products yet"
            description="This seller hasn't listed any products yet — check back soon."
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {store.products.map((product) => (
              <article
                key={product.id}
                className="flex flex-col overflow-hidden rounded-lg border border-border-default bg-bg-surface"
              >
                <div className="aspect-square bg-bg-sunken">
                  {product.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.images[0].url}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex flex-col gap-1 p-3">
                  <p className="line-clamp-2 text-sm font-medium text-text-primary">
                    {product.name}
                  </p>
                  <p className="font-display text-sm font-bold text-text-primary">
                    {product.currencyCode} {product.price.toString()}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
