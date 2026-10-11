"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
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
    <main className="grid min-h-dvh place-items-center bg-canvas px-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        {decision.kind === "blocked" ? (
          <TriangleAlert aria-hidden="true" className="size-7 text-critical-ink" />
        ) : (
          <LoaderCircle aria-hidden="true" className="size-7 animate-spin text-label-2" />
        )}
        <p role={decision.kind === "blocked" ? "alert" : "status"} className="text-[1rem] leading-relaxed text-label-2">
          {decision.kind === "blocked" ? decision.message : "Checking your access…"}
        </p>
      </div>
    </main>
  );
}
