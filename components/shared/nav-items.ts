import {
    LayoutDashboard,
    ArrowLeftRight,
    Wallet,
    Tags,
    PiggyBank,
    type LucideIcon,
} from "lucide-react";

export type NavItem = {
    title: string;
    url: string;
    icon: LucideIcon;
};

// Shared navigation items used by both the desktop sidebar and the
// mobile floating navigation bar.
export const navItems: NavItem[] = [
    {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        title: "Transactions",
        url: "/transactions",
        icon: ArrowLeftRight,
    },
    {
        title: "Wallets",
        url: "/wallets",
        icon: Wallet,
    },
    {
        title: "Categories",
        url: "/categories",
        icon: Tags,
    },
    {
        title: "Budgets",
        url: "/budgets",
        icon: PiggyBank,
    },
];
