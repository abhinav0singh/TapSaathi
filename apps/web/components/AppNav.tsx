"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { hasRole, signOut } from "@/lib/auth";
import { useIdentity } from "@/components/useIdentity";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string };

export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const state = useIdentity();

  const identity = state.status === "signed-in" ? state.identity : null;

  const items: NavItem[] = [];
  items.push({ href: "/", label: "Home" }, { href: "/demo", label: "Recorded run" });
  if (!identity) {
    items.push({ href: "/ops", label: "Operations" }, { href: "/login", label: "Sign in" });
  } else {
    if (hasRole(identity, "OPERATOR") || hasRole(identity, "SUPERVISOR")) {
      items.push({ href: "/ops", label: "Operations" });
    }
    if (hasRole(identity, "SUPERVISOR")) {
      items.push({ href: "/supervisor", label: "Supervisor" });
    }
    if (hasRole(identity, "WORKER") && identity.actorId) {
      items.push({
        href: `/worker/${encodeURIComponent(identity.actorId)}`,
        label: "My safety screen",
      });
    }
  }

  function handleSignOut() {
    try {
      signOut();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <nav aria-label="Primary navigation" className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-9 shrink-0 items-center rounded-full px-3.5 text-[0.9375rem] font-medium",
              active ? "bg-surface text-label shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-label-2 hover:text-label",
            )}
          >
            {item.label}
          </Link>
        );
      })}

      {identity && (
        <>
          <span className="ml-2 shrink-0 text-[0.875rem] text-label-2" aria-label="Signed in as">
            {identity.username}
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            className="ml-1 inline-flex min-h-9 shrink-0 items-center gap-1.5 px-2 text-[0.9375rem] text-label-2 hover:text-label"
          >
            <LogOut aria-hidden="true" className="size-4" />
            Sign out
          </button>
        </>
      )}
    </nav>
  );
}
