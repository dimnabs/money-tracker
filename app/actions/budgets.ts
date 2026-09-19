"use server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createBudgetSchema, CreateBudgetInput } from "@/schemas/budget.schema";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type BudgetProgress = {
    id: string;
    name: string;
    categoryIds: string[];
    categoryNames: string[];
    budgeted: number;
    spent: number;
    startMonth: number;
    startYear: number;
};

export async function getBudgetProgress(year: number, month: number): Promise<BudgetProgress[]> {
    const user = await getCurrentUser();
    if (!user) redirect("/");

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const budgets = await prisma.budget.findMany({
        where: {
            userId: user.id,
            OR: [
                { startYear: { lt: year } },
                { startYear: year, startMonth: { lte: month } },
            ],
        },
        include: {
            categories: {
                include: {
                    category: {
                        select: {
                            id: true,
                            name: true,
                            transactions: {
                                where: { type: "EXPENSE", date: { gte: start, lt: end } },
                                select: { amount: true },
                            },
                        },
                    },
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    return budgets.map((budget) => ({
        id: budget.id,
        name: budget.name,
        categoryIds: budget.categories.map(({ category }) => category.id),
        categoryNames: budget.categories.map(({ category }) => category.name).sort(),
        budgeted: Number(budget.amount),
        startMonth: budget.startMonth,
        startYear: budget.startYear,
        spent: budget.categories.reduce(
            (total, { category }) => total + category.transactions.reduce(
                (categoryTotal, transaction) => categoryTotal + Number(transaction.amount),
                0,
            ),
            0,
        ),
    }));
}

export async function getAssignedBudgetCategoryIds(): Promise<string[]> {
    const user = await getCurrentUser();
    if (!user) redirect("/");

    const assignments = await prisma.budgetCategory.findMany({
        where: { budget: { userId: user.id } },
        select: { categoryId: true },
    });
    return assignments.map(({ categoryId }) => categoryId);
}

export async function saveBudget(data: CreateBudgetInput) {
    const user = await getCurrentUser();
    if (!user) redirect("/");

    const parsed = createBudgetSchema.parse(data);
    const jakartaNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const startYear = jakartaNow.getUTCFullYear();
    const startMonth = jakartaNow.getUTCMonth() + 1;
    const categoryIds = [...new Set(parsed.categoryIds)];
    const categories = await prisma.category.findMany({
        where: { id: { in: categoryIds }, userId: user.id, type: "EXPENSE" },
        select: { id: true },
    });
    if (categories.length !== categoryIds.length) throw new Error("One or more expense categories were not found");

    const alreadyAssigned = await prisma.budgetCategory.findFirst({
        where: {
            categoryId: { in: categoryIds },
            budget: { userId: user.id },
        },
    });
    if (alreadyAssigned) throw new Error("A selected category already belongs to another recurring budget");

    await prisma.budget.create({
        data: {
            userId: user.id,
            name: parsed.name,
            amount: parsed.amount,
            startMonth,
            startYear,
            categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
        },
    });

    revalidatePath("/budgets");
    revalidatePath("/dashboard");

    return { startMonth, startYear };
}

export async function deleteBudget(id: string) {
    const user = await getCurrentUser();
    if (!user) redirect("/");

    await prisma.budget.delete({ where: { id, userId: user.id } });
    revalidatePath("/budgets");
    revalidatePath("/dashboard");
}
