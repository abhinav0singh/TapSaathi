"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  destinationForIdentity,
  hasRole,
  type AuthenticatedIdentity,
  type Role,
} from "@/lib/auth";
import { useIdentity } from "@/components/useIdentity";

type Props = {
  /** Roles allowed to see this route. */
  allow: Role[];
  /** For rider screens: a WORKER may only open their own profile. */
  workerId?: string;
  /** Read-only public viewing for signed-out visitors (the API's GET routes are public). */
  allowAnonymous?: boolean;
  children: ReactNode;
};

function permitted(identity: AuthenticatedIdentity, allow: Role[], workerId?: string) {
  if (allow.includes("OPERATOR") && hasRole(identity, "OPERATOR")) return true;
  if (allow.includes("SUPERVISOR") && hasRole(identity, "SUPERVISOR")) return true;
  if (allow.includes("WORKER") && hasRole(identity, "WORKER")) {
    return !workerId || identity.actorId === workerId;
  }
  return false;
}

/**
 * UI-level route guard. It improves the experience only: the backend remains the
 * authority for every action, and the API's GET routes are still publicly readable.
 */
export default function RoleGuard({ allow, workerId, allowAnonymous = false, children }: Props) {
  const router = useRouter();
  const state = useIdentity();

  const decision = useMemo(() => {
    if (state.status === "loading") return { kind: "loading" } as const;

    if (state.status === "anonymous") {
      return allowAnonymous ? ({ kind: "allow" } as const) : ({ kind: "login" } as const);
    }

    if (permitted(state.identity, allow, workerId)) return { kind: "allow" } as const;

    try {
      return { kind: "redirect", to: destinationForIdentity(state.identity) } as const;
    } catch (error) {
      return {
        kind: "blocked",
        message: error instanceof Error ? error.message : "You do not have access to this page.",
      } as const;
    }
  }, [state, allow, workerId, allowAnonymous]);

  useEffect(() => {
    if (decision.kind === "login") router.replace("/login");
    if (decision.kind === "redirect") router.replace(decision.to);
  }, [decision, router]);

  if (decision.kind === "allow") return <>{children}</>;

  // Public pages render immediately while the session check finishes.
  if (decision.kind === "loading" && allowAnonymous) return <>{children}</>;

  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f7fb] px-4 text-slate-700">
      <p role={decision.kind === "blocked" ? "alert" : "status"} className="max-w-sm text-center text-sm">
        {decision.kind === "blocked" ? decision.message : "Checking your access…"}
      </p>
    </main>
  );
}
