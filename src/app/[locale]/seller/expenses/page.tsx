import { prisma } from "@/server/db";
import { requireApprovedSeller } from "@/server/auth/seller-guard";
import { listExpensesForSeller } from "@/server/services/expenses";
import { createExpenseAction, deleteExpenseAction } from "@/server/expenses/actions";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { ExpenseForm } from "@/components/ExpenseForm";

export default async function SellerExpensesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { seller } = await requireApprovedSeller(locale);

  const [expenses, currencies] = await Promise.all([
    listExpensesForSeller(seller.id),
    prisma.currency.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="vm-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-2xl font-bold text-text-primary">Expenses</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          {expenses.length === 0 ? (
            <EmptyState title="No expenses recorded yet" />
          ) : (
            expenses.map((expense) => (
              <Card key={expense.id}>
                <CardBody className="flex items-center justify-between">
                  <div>
                    <p className="font-display font-semibold text-text-primary">
                      {expense.description || expense.category.replaceAll("_", " ")}
                    </p>
                    <p className="text-sm text-text-muted">
                      <Badge variant="neutral">{expense.category.replaceAll("_", " ")}</Badge>{" "}
                      {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(expense.incurredAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display font-bold text-text-primary">
                      {expense.currencyCode} {expense.amount.toString()}
                    </span>
                    <DeleteButton
                      action={deleteExpenseAction.bind(null, expense.id)}
                      confirmMessage="Delete this expense?"
                      label="Delete"
                    />
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>

        <Card>
          <CardBody>
            <ExpenseForm currencies={currencies} action={createExpenseAction} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
