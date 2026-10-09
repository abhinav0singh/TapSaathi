"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { hasRole, signOut } from "@/lib/auth";
import { useIdentity } from "@/components/useIdentity";

const style =
  "rounded-lg px-1 py-2 text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline focus-visible:outline-2 focus-visible:outline-orange-600";

/** Riders get Sign out; staff and visitors keep the way back to Operations. */
export default function RiderSessionLink() {
  const router = useRouter();
  const state = useIdentity();

  const isRider =
    state.status === "signed-in" &&
    hasRole(state.identity, "WORKER") &&
    !hasRole(state.identity, "OPERATOR") &&
    !hasRole(state.identity, "SUPERVISOR");

  if (isRider) {
    return (
      <button
        type="button"
        onClick={() => {
          try {
            signOut();
          } finally {
            router.replace("/login");
            router.refresh();
          }
        }}
        className={style}
      >
        Sign out
      </button>
    );
  }

  return (
    <Link href="/ops" className={style}>
      ← Operations
    </Link>
  );
}
