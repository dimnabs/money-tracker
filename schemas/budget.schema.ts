import { z } from "zod";
import { amountSchema } from "./common.schema";

export const createBudgetSchema = z.object({
  name: z.string().trim().min(1, "Budget name is required").max(80, "Budget name is too long"),
  categoryIds: z.array(z.string().cuid()).min(1, "Select at least one category"),
  amount: amountSchema,
});

export type CreateBudgetInput = z.infer<
  typeof createBudgetSchema
>;
