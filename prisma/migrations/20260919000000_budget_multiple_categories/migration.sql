-- CreateTable
CREATE TABLE "BudgetCategory" (
    "budgetId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "BudgetCategory_pkey" PRIMARY KEY ("budgetId", "categoryId")
);

-- Preserve every existing single-category budget as its first category link.
INSERT INTO "BudgetCategory" ("budgetId", "categoryId")
SELECT "id", "categoryId" FROM "Budget";

-- Replace the single category relation with the join table.
ALTER TABLE "Budget" DROP CONSTRAINT "Budget_categoryId_fkey";
DROP INDEX "Budget_userId_categoryId_month_year_key";
ALTER TABLE "Budget" DROP COLUMN "categoryId";

CREATE INDEX "Budget_userId_month_year_idx" ON "Budget"("userId", "month", "year");
CREATE INDEX "BudgetCategory_categoryId_idx" ON "BudgetCategory"("categoryId");

ALTER TABLE "BudgetCategory" ADD CONSTRAINT "BudgetCategory_budgetId_fkey"
FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BudgetCategory" ADD CONSTRAINT "BudgetCategory_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
