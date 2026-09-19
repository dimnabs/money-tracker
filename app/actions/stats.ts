"use server";

import { prisma } from "@/lib/prisma";
import { StatisticData } from "@/types/statistic-data";
import { getStartOfMonthUTC7, getEndOfMonthUTC7 } from "@/lib/date-utils";

export async function getStatisticsData(userId: string): Promise<StatisticData> {
    const totalBalance = await prisma.wallet.aggregate({
        _sum: {
            balance: true,
        },
        where: {
            userId: userId,
        }
    });

    const totalExpenses = await prisma.transaction.aggregate({
        _sum: {
            amount: true,
        },
        where: {
            userId: userId,
            type: 'EXPENSE',
            createdAt: {
                gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
            },
        }
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const allBudgets = await prisma.budget.findMany({
        where: {
            userId: userId,
            OR: [
                { startYear: { lt: now.getFullYear() } },
                {
                    startYear: now.getFullYear(),
                    startMonth: { lte: now.getMonth() + 1 },
                },
            ],
        },
        include: {
            categories: { select: { categoryId: true } },
        },
    });

    let budgetsRemaining = 0;
    for (const budget of allBudgets) {
        const spent = await prisma.transaction.aggregate({
            _sum: {
                amount: true,
            },
            where: {
                userId: userId,
                type: 'EXPENSE',
                categoryId: { in: budget.categories.map(({ categoryId }) => categoryId) },
                date: { gte: monthStart, lt: monthEnd },
            }
        });

        const budgetAmount = Number(budget.amount) || 0;
        const spentAmount = Number(spent._sum.amount ?? 0) || 0;
        const remaining = budgetAmount - spentAmount;
        budgetsRemaining += remaining > 0 ? remaining : 0;
    }

    return {
        totalBalance: totalBalance._sum.balance || 0,
        totalExpenses: totalExpenses._sum.amount || 0,
        budgetsRemaining: budgetsRemaining,
    };
}

export interface MonthlyTransactionStats {
    totalIncome: number;
    totalExpenses: number;
    net: number;
    transactionCount: number;
    dailyTrend: { date: string; income: number; expenses: number }[];
}

export async function getMonthlyTransactionStats(
    userId: string,
    year?: number,
    month?: number
): Promise<MonthlyTransactionStats> {
    const now = new Date();
    // Adjust for UTC+7
    const utc7Now = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const targetYear = year ?? utc7Now.getUTCFullYear();
    const targetMonth = month ?? utc7Now.getUTCMonth() + 1; // 1-indexed month

    const startOfMonth = getStartOfMonthUTC7(targetYear, targetMonth);
    const endOfMonth = getEndOfMonthUTC7(targetYear, targetMonth);

    const [incomeResult, expenseResult, transactions] = await Promise.all([
        prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
                userId,
                type: 'INCOME',
                date: { gte: startOfMonth, lt: endOfMonth },
            },
        }),
        prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
                userId,
                type: 'EXPENSE',
                date: { gte: startOfMonth, lt: endOfMonth },
            },
        }),
        prisma.transaction.findMany({
            where: {
                userId,
                type: { in: ['INCOME', 'EXPENSE'] },
                date: { gte: startOfMonth, lt: endOfMonth },
            },
            select: {
                date: true,
                amount: true,
                type: true,
            },
            orderBy: { date: 'asc' },
        }),
    ]);

    const totalIncome = Number(incomeResult._sum.amount ?? 0);
    const totalExpenses = Number(expenseResult._sum.amount ?? 0);

    // Group transactions by date for daily trend
    const dailyMap = new Map<string, { income: number; expenses: number }>();

    // Initialize all days of the month
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        dailyMap.set(dateStr, { income: 0, expenses: 0 });
    }

    // Aggregate transaction amounts by date
    for (const tx of transactions) {
        // Convert transaction date to UTC+7 for proper date string
        const txDateUTC7 = new Date(tx.date.getTime() + 7 * 60 * 60 * 1000);
        const year = txDateUTC7.getUTCFullYear();
        const month = String(txDateUTC7.getUTCMonth() + 1).padStart(2, '0');
        const day = String(txDateUTC7.getUTCDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const existing = dailyMap.get(dateStr) || { income: 0, expenses: 0 };
        if (tx.type === 'INCOME') {
            existing.income += Number(tx.amount);
        } else {
            existing.expenses += Number(tx.amount);
        }
        dailyMap.set(dateStr, existing);
    }

    const dailyTrend = Array.from(dailyMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

    return {
        totalIncome,
        totalExpenses,
        net: totalIncome - totalExpenses,
        transactionCount: transactions.length,
        dailyTrend,
    };
}
