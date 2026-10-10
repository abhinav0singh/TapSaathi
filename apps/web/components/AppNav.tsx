"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { hasRole, signOut } from "@/lib/auth";
import { useIdentity } from "@/components/useIdentity";

type NavItem = { href: string; label: string };

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600";

export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const state = useIdentity();

  const identity = state.status === "signed-in" ? state.identity : null;

  const items: NavItem[] = [];
  items.push({ href: "/", label: "Home" });
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
    <nav
      aria-label="Primary navigation"
      className="flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200/80 bg-white/90 p-1 shadow-sm backdrop-blur"
    >
      {items.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${focus} ${
              active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`}
          >
            {item.label}
          </Link>
        );
      })}

      {identity && (
        <>
          <span className="px-2 text-xs text-slate-500" aria-label="Signed in as">
            {identity.username}
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            className={`rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 ${focus}`}
          >
            Sign out
          </button>
        </>
      )}
    </nav>
  );
}
