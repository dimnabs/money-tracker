"use client";

import { deleteBudget, getAssignedBudgetCategoryIds, getBudgetProgress, saveBudget, type BudgetProgress } from "@/app/actions/budgets";
import { MonthSelector } from "@/components/transactions/MonthSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SerializedCategory } from "@/types/category";
import { Check, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

const formatAmount = (amount: number) =>
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amount);

const formatMonth = (month: number, year: number) =>
    new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(year, month - 1));

export function BudgetsClient({ initialBudgets, initialAssignedCategoryIds, categories }: { initialBudgets: BudgetProgress[]; initialAssignedCategoryIds: string[]; categories: SerializedCategory[] }) {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [budgets, setBudgets] = useState(initialBudgets);
    const [assignedCategoryIds, setAssignedCategoryIds] = useState(initialAssignedCategoryIds);
    const [name, setName] = useState("");
    const [categoryIds, setCategoryIds] = useState<string[]>([]);
    const [amount, setAmount] = useState("");
    const [isPending, startTransition] = useTransition();
    const availableCategories = categories.filter(
        (category) => !assignedCategoryIds.includes(category.id),
    );

    const getCategoryLabel = (category: SerializedCategory) => {
        const parent = categories.find((candidate) => candidate.id === category.parentId);
        return parent ? `${parent.name} › ${category.name}` : category.name;
    };

    const toggleCategory = (id: string) => {
        setCategoryIds((current) => current.includes(id)
            ? current.filter((categoryId) => categoryId !== id)
            : [...current, id]);
    };

    const refresh = (nextMonth = month, nextYear = year) => startTransition(async () => {
        const [nextBudgets, nextAssignedCategoryIds] = await Promise.all([
            getBudgetProgress(nextYear, nextMonth),
            getAssignedBudgetCategoryIds(),
        ]);
        setBudgets(nextBudgets);
        setAssignedCategoryIds(nextAssignedCategoryIds);
    });

    const handleMonthChange = (nextMonth: number, nextYear: number) => {
        setMonth(nextMonth);
        setYear(nextYear);
        setCategoryIds([]);
        refresh(nextMonth, nextYear);
    };

    const handleSave = async (event: React.FormEvent) => {
        event.preventDefault();
        const parsedAmount = Number(amount);
        if (!name.trim() || categoryIds.length === 0 || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            toast.error("Enter a name, choose at least one category, and set a budget greater than zero.");
            return;
        }
        startTransition(async () => {
            try {
                const created = await saveBudget({ name, categoryIds, amount: parsedAmount });
                setName("");
                setCategoryIds([]);
                setAmount("");
                const [nextBudgets, nextAssignedCategoryIds] = await Promise.all([
                    getBudgetProgress(created.startYear, created.startMonth),
                    getAssignedBudgetCategoryIds(),
                ]);
                setMonth(created.startMonth);
                setYear(created.startYear);
                setBudgets(nextBudgets);
                setAssignedCategoryIds(nextAssignedCategoryIds);
                toast.success("Budget saved");
            } catch {
                toast.error("Could not save this budget.");
            }
        });
    };

    return <div className="relative space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Budgets</h1>
                <p className="text-muted-foreground">Set recurring monthly limits for expense categories and track what is left.</p>
            </div>
            <div className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Viewing month</span>
                <MonthSelector currentMonth={month} currentYear={year} onMonthChange={handleMonthChange} />
            </div>
        </div>

        <Card>
            <CardHeader><CardTitle>Add a budget</CardTitle><CardDescription>Select one or more categories. The budget starts this month and automatically repeats every month.</CardDescription></CardHeader>
            <CardContent>
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="budget-name">Budget name</Label>
                        <Input id="budget-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="e.g. Food & Dining" />
                    </div>
                    <div className="grid gap-2">
                        <Label>Expense categories</Label>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button type="button" variant="outline" className="h-auto min-h-11 w-full justify-between whitespace-normal px-3 py-2 text-left font-normal" disabled={availableCategories.length === 0}>
                                    <span className={categoryIds.length === 0 ? "text-muted-foreground" : ""}>
                                        {categoryIds.length === 0
                                            ? "Choose categories"
                                            : `${categoryIds.length} ${categoryIds.length === 1 ? "category" : "categories"} selected`}
                                    </span>
                                    <Plus className="size-4 shrink-0" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="grid max-h-[85dvh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-md">
                                <DialogHeader className="p-5 pb-4 text-left">
                                    <DialogTitle>Select categories</DialogTitle>
                                    <DialogDescription>Choose every expense category that should share this budget.</DialogDescription>
                                </DialogHeader>
                                <div className="overflow-y-auto border-y p-3">
                                    <div className="grid gap-2">
                                        {availableCategories.map((category) => {
                                            const selected = categoryIds.includes(category.id);
                                            return <Button
                                                key={category.id}
                                                type="button"
                                                variant={selected ? "secondary" : "ghost"}
                                                className="min-h-12 w-full justify-between whitespace-normal px-3 py-2 text-left"
                                                aria-pressed={selected}
                                                onClick={() => toggleCategory(category.id)}
                                            >
                                                <span className="min-w-0 flex-1">{getCategoryLabel(category)}</span>
                                                <span className={`ml-3 flex size-5 shrink-0 items-center justify-center rounded border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                                                    {selected && <Check className="size-3.5" />}
                                                </span>
                                            </Button>;
                                        })}
                                    </div>
                                </div>
                                <DialogFooter className="flex-row items-center justify-between p-4">
                                    <span className="text-sm text-muted-foreground">{categoryIds.length} selected</span>
                                    <DialogClose asChild><Button type="button">Done</Button></DialogClose>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        {availableCategories.length === 0 && <p className="text-sm text-muted-foreground">All expense categories already belong to recurring budgets.</p>}
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="grid flex-1 gap-2"><Label htmlFor="budget-amount">Monthly budget</Label><Input id="budget-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></div>
                        <Button type="submit" disabled={isPending || !name.trim() || categoryIds.length === 0}><Plus />Save budget</Button>
                    </div>
                </form>
            </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {budgets.map((budget) => {
                const remaining = budget.budgeted - budget.spent;
                const percentage = Math.min((budget.spent / budget.budgeted) * 100, 100);
                return <Card key={budget.id}>
                    <CardHeader className="gap-1"><div className="flex items-start justify-between gap-2"><CardTitle>{budget.name}</CardTitle><Button variant="ghost" size="icon" aria-label={`Delete ${budget.name}`} disabled={isPending} onClick={() => startTransition(async () => { await deleteBudget(budget.id); const [nextBudgets, nextAssignedCategoryIds] = await Promise.all([getBudgetProgress(year, month), getAssignedBudgetCategoryIds()]); setBudgets(nextBudgets); setAssignedCategoryIds(nextAssignedCategoryIds); })}><Trash2 className="size-4" /></Button></div><CardDescription>{formatAmount(budget.spent)} spent of {formatAmount(budget.budgeted)} · Repeats monthly since {formatMonth(budget.startMonth, budget.startYear)}</CardDescription></CardHeader>
                    <CardContent className="space-y-3"><div className="flex flex-wrap gap-1">{budget.categoryNames.map((name, index) => <span key={`${name}-${index}`} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{name}</span>)}</div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={remaining < 0 ? "h-full bg-destructive" : "h-full bg-primary"} style={{ width: `${percentage}%` }} /></div><p className={remaining < 0 ? "font-medium text-destructive" : "font-medium text-emerald-600 dark:text-emerald-400"}>{remaining < 0 ? `${formatAmount(Math.abs(remaining))} over budget` : `${formatAmount(remaining)} left`}</p></CardContent>
                </Card>;
            })}
        </div>
        {!isPending && budgets.length === 0 && <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">No budgets for this month yet. Add one above to start tracking your spending.</div>}
        {isPending && <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/50"><div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}
    </div>;
}
