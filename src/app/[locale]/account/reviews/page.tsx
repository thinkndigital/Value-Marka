import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/server/auth/guards";
import { listReviewsForUser } from "@/server/services/reviews";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);
  const t = await getTranslations("Reviews");

  const reviews = await listReviewsForUser(user.id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold text-text-primary">{t("title")}</h1>

      {reviews.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardBody className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/product/${review.product.slug}`}
                    className="font-display font-semibold text-text-primary hover:underline"
                  >
                    {review.product.name}
                  </Link>
                  <span className="text-text-muted">{"★".repeat(review.rating)}</span>
                </div>
                {review.title ? <p className="font-medium text-text-primary">{review.title}</p> : null}
                {review.body ? <p className="text-sm text-text-secondary">{review.body}</p> : null}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
