"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, KanbanSquare, ListChecks, Settings, LogOut, Columns3 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/creators", label: "Creators", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/lists", label: "Lists", icon: ListChecks },
  { href: "/compare", label: "Compare", icon: Columns3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

export function SideNav() {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition",
            isActive(path, href) ? "bg-side-active text-white" : "text-side-ink hover:bg-side-active/60 hover:text-white",
          )}
        >
          <Icon className="size-4 opacity-80" strokeWidth={1.8} />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileNav() {
  const path = usePathname();
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
      {NAV.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-medium",
            isActive(path, href) ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      className={cn("inline-flex items-center gap-1.5 text-[12.5px] text-side-ink hover:text-white", className)}
      onClick={async () => {
        await authClient.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      <LogOut className="size-3.5" /> Sign out
    </button>
  );
}
