"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/ops", label: "Operations" },
  { href: "/supervisor", label: "Supervisor" },
  { href: "/login", label: "Sign in" },
];

export default function AppNav({ supervisorOnly = false }: { supervisorOnly?: boolean }) {
  const pathname = usePathname();
  const visibleItems = supervisorOnly
    ? items.filter((item) => item.href !== "/ops")
    : items;

  return (
    <nav aria-label="Primary navigation" className="flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
      {visibleItems.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 ${
              active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
