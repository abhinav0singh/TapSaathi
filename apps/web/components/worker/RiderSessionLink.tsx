"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { hasRole, signOut } from "@/lib/auth";
import { useIdentity } from "@/components/useIdentity";

const style =
  "inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-base font-semibold text-ink underline-offset-4 hover:underline";

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
        <LogOut aria-hidden="true" className="size-5" />
        Sign out
      </button>
    );
  }

  return (
    <Link href="/ops" className={style}>
      <ArrowLeft aria-hidden="true" className="size-5" />
      Operations
    </Link>
  );
}
