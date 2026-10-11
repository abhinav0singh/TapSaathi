"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { hasRole, signOut } from "@/lib/auth";
import { useIdentity } from "@/components/useIdentity";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string };

/** The landing page is the only public walkthrough; authenticated pages are product workspaces. */
function useNavItems(): NavItem[] {
  const state = useIdentity();
  const identity = state.status === "signed-in" ? state.identity : null;

  const items: NavItem[] = [{ href: "/", label: "Home" }];
  if (!identity) {
    items.push({ href: "/ops", label: "Operations" }, { href: "/login", label: "Sign in" });
    return items;
  }
  if (hasRole(identity, "OPERATOR") || hasRole(identity, "SUPERVISOR")) {
    items.push({ href: "/ops", label: "Operations" });
  }
  if (hasRole(identity, "SUPERVISOR")) {
    items.push({ href: "/supervisor", label: "Supervisor" });
  }
  if (hasRole(identity, "WORKER") && identity.actorId) {
    items.push({ href: `/worker/${encodeURIComponent(identity.actorId)}`, label: "My safety screen" });
  }
  return items;
}

/** Page links. Compact on phones so the common four fit without scrolling. */
export function NavLinks() {
  const pathname = usePathname();
  const items = useNavItems();

  return (
    <nav aria-label="Primary navigation" className="no-scrollbar flex min-w-0 items-center gap-0.5 overflow-x-auto sm:gap-1">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center rounded-full px-3 text-[0.875rem] font-medium sm:min-h-9 sm:px-3.5 sm:text-[0.9375rem]",
              active ? "bg-surface text-label shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-label-2 hover:text-label",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Who is signed in, and the way out. Renders nothing for visitors. */
export function AccountControls() {
  const router = useRouter();
  const state = useIdentity();
  if (state.status !== "signed-in") return null;

  function handleSignOut() {
    try {
      signOut();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <span className="hidden max-w-40 truncate text-[0.875rem] text-label-2 sm:inline" aria-label="Signed in as">
        {state.identity.username}
      </span>
      <button
        type="button"
        onClick={handleSignOut}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[0.875rem] text-label-2 hover:text-label sm:text-[0.9375rem]"
      >
        <LogOut aria-hidden="true" className="size-4" />
        Sign out
      </button>
    </div>
  );
}
