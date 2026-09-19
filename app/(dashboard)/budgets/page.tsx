import { getAssignedBudgetCategoryIds, getBudgetProgress } from "@/app/actions/budgets";
import { getCategories } from "@/app/actions/categories";
import { BudgetsClient } from "@/components/budgets/BudgetsClient";

export default async function BudgetsPage() {
    const now = new Date();
    const [budgets, categories, assignedCategoryIds] = await Promise.all([
        getBudgetProgress(now.getFullYear(), now.getMonth() + 1),
        getCategories(),
        getAssignedBudgetCategoryIds(),
    ]);
    return <BudgetsClient initialBudgets={budgets} initialAssignedCategoryIds={assignedCategoryIds} categories={categories.filter((category) => category.type === "EXPENSE").map((category) => ({ ...category, createdAt: category.createdAt.toISOString(), updatedAt: category.updatedAt.toISOString() }))} />;
}
