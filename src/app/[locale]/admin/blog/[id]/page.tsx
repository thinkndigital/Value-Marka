import { notFound } from "next/navigation";
import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Card, CardBody } from "@/components/ui/Card";
import { BlogPostForm } from "@/components/admin/BlogPostForm";
import { getBlogPostForAdmin, listBlogCategories, BlogError } from "@/server/services/blog";
import { updateBlogPostAction } from "@/server/blog/actions";

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "cms.update"))) {
    return <Forbidden />;
  }

  let post;
  try {
    post = await getBlogPostForAdmin(id);
  } catch (err) {
    if (err instanceof BlogError) notFound();
    throw err;
  }

  const categories = await listBlogCategories();

  return (
    <div className="vm-container flex max-w-3xl flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">Edit: {post.titleEn}</h1>
      <Card>
        <CardBody>
          <BlogPostForm
            action={updateBlogPostAction.bind(null, post.id)}
            categories={categories}
            initial={{
              titleEn: post.titleEn,
              titleAr: post.titleAr,
              excerptEn: post.excerptEn,
              excerptAr: post.excerptAr,
              bodyEn: post.bodyEn,
              bodyAr: post.bodyAr,
              coverImageUrl: post.coverImageUrl,
              seoTitle: post.seoTitle,
              seoDescription: post.seoDescription,
              categoryId: post.categoryId,
              tags: post.tags.map((t) => t.tag.slug).join(", "),
            }}
            submitLabel="Save changes"
          />
        </CardBody>
      </Card>
    </div>
  );
}
