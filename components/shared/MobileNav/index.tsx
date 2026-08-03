"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useActionState } from "react";

import { cn } from "@/lib/utils";
import { navItems } from "@/components/shared/nav-items";
import { NavPendingIndicator } from "@/components/shared/NavPendingIndicator";
import { logout } from "@/app/actions/auth";

export function MobileNav() {
    const pathname = usePathname();
    const [, handleSignout] = useActionState(logout, undefined);

    return (
        <nav
            aria-label="Primary"
            className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden"
        >
            <div className="flex w-full max-w-md items-center justify-around gap-1 rounded-2xl border bg-background/80 p-1.5 shadow-lg backdrop-blur-lg">
                {navItems.map((item) => {
                    const isActive =
                        pathname === item.url ||
                        pathname.startsWith(item.url + "/");
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.title}
                            href={item.url}
                            aria-current={isActive ? "page" : undefined}
                            className={cn(
                                "flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[0.65rem] font-medium transition-colors",
                                isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            <span className="relative flex items-center justify-center">
                                <Icon
                                    className={cn(
                                        "size-5 transition-transform",
                                        isActive && "scale-110",
                                    )}
                                />
                                <NavPendingIndicator className="absolute size-4" />
                            </span>
                            <span className="leading-none">{item.title}</span>
                        </Link>
                    );
                })}
                <button
                    type="button"
                    onClick={() => handleSignout()}
                    className="flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[0.65rem] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                    <span className="relative flex items-center justify-center">
                        <LogOut className="size-5" />
                    </span>
                    <span className="leading-none">Logout</span>
                </button>
            </div>
        </nav>
    );
}
