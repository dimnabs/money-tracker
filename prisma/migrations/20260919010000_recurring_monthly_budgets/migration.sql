-- Existing budget months become the first month of an ongoing monthly budget.
ALTER TABLE "Budget" RENAME COLUMN "month" TO "startMonth";
ALTER TABLE "Budget" RENAME COLUMN "year" TO "startYear";

DROP INDEX "Budget_userId_month_year_idx";
CREATE INDEX "Budget_userId_startYear_startMonth_idx"
ON "Budget"("userId", "startYear", "startMonth");
