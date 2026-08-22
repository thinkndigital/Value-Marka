import { hasPermission } from "@/server/rbac";
import { requireUser } from "@/server/auth/guards";
import { Forbidden } from "@/components/Forbidden";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { FormActionButton } from "@/components/admin/FormActionButton";
import { BlogCategoryForm } from "@/components/admin/BlogCategoryForm";
import { listBlogPostsForAdmin, listBlogCategories } from "@/server/services/blog";
import {
  publishBlogPostAction,
  unpublishBlogPostAction,
  deleteBlogPostAction,
  deleteBlogCategoryAction,
} from "@/server/blog/actions";

export default async function AdminBlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);

  if (!(await hasPermission(user.id, "cms.read"))) {
    return <Forbidden />;
  }
  const canUpdate = await hasPermission(user.id, "cms.update");

  const [posts, categories] = await Promise.all([listBlogPostsForAdmin(), listBlogCategories()]);

  return (
    <div className="vm-container flex flex-col gap-8 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Blog</h1>
          <p className="text-sm text-text-muted">
            Draft posts are only visible here — publishing makes a post appear at /blog.
          </p>
        </div>
        {canUpdate ? (
          <Button href="/admin/blog/new" variant="primary" size="sm">
            New post
          </Button>
        ) : null}
      </div>

      {canUpdate ? (
        <Card>
          <CardHeader>
            <h2 className="font-display font-semibold text-text-primary">Categories</h2>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center gap-1 rounded-pill bg-bg-sunken px-3 py-1.5">
                  <span className="text-sm text-text-secondary">{c.nameEn}</span>
                  <DeleteButton
                    action={deleteBlogCategoryAction.bind(null, c.id)}
                    confirmMessage={`Delete category "${c.nameEn}"?`}
                    label="×"
                  />
                </div>
              ))}
              {categories.length === 0 ? (
                <p className="text-sm text-text-muted">No categories yet.</p>
              ) : null}
            </div>
            <BlogCategoryForm />
          </CardBody>
        </Card>
      ) : null}

      {posts.length === 0 ? (
        <EmptyState
          title="No posts yet"
          action={
            canUpdate ? (
              <Button href="/admin/blog/new" variant="primary">
                New post
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border-default bg-bg-sunken text-xs font-semibold uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3 text-start">Title</th>
                <th className="px-4 py-3 text-start">Category</th>
                <th className="px-4 py-3 text-start">Status</th>
                <th className="px-4 py-3 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} className="border-b border-border-default last:border-0">
                  <td className="px-4 py-3 font-medium text-text-primary">{post.titleEn}</td>
                  <td className="px-4 py-3 text-text-secondary">{post.category?.nameEn ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={post.status === "PUBLISHED" ? "success" : "neutral"}>
                      {post.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <>
                          <Button href={`/admin/blog/${post.id}`} variant="outline" size="sm">
                            Edit
                          </Button>
                          <FormActionButton
                            action={
                              post.status === "PUBLISHED"
                                ? unpublishBlogPostAction.bind(null, post.id)
                                : publishBlogPostAction.bind(null, post.id)
                            }
                            label={post.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                          />
                          <DeleteButton
                            action={deleteBlogPostAction.bind(null, post.id)}
                            confirmMessage={`Delete "${post.titleEn}"? This cannot be undone.`}
                          />
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
