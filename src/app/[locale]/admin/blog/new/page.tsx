import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Card, CardBody } from "@/components/ui/Card";
import { BlogPostForm } from "@/components/admin/BlogPostForm";
import { listBlogCategories } from "@/server/services/blog";
import { createBlogPostAction } from "@/server/blog/actions";

export default async function NewBlogPostPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "cms.update"))) {
    return <Forbidden />;
  }

  const categories = await listBlogCategories();

  return (
    <div className="vm-container flex max-w-3xl flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">New blog post</h1>
      <Card>
        <CardBody>
          <BlogPostForm
            action={createBlogPostAction}
            categories={categories}
            includeSlug
            redirectTo="/admin/blog"
          />
        </CardBody>
      </Card>
    </div>
  );
}
