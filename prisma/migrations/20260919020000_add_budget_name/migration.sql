ALTER TABLE "Budget" ADD COLUMN "name" TEXT;

-- Give existing budgets a useful name based on their selected categories.
UPDATE "Budget" AS budget
SET "name" = COALESCE(
    (
        SELECT string_agg(category."name", ' + ' ORDER BY category."name")
        FROM "BudgetCategory" AS selection
        JOIN "Category" AS category ON category."id" = selection."categoryId"
        WHERE selection."budgetId" = budget."id"
    ),
    'Monthly budget'
);

ALTER TABLE "Budget" ALTER COLUMN "name" SET NOT NULL;
