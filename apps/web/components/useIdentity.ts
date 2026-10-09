"use client";

import { useEffect, useState } from "react";
import { getAuthenticatedIdentity, type AuthenticatedIdentity } from "@/lib/auth";

export type IdentityState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "signed-in"; identity: AuthenticatedIdentity };

/** Reads the current Cognito session once on mount. Errors count as signed out. */
export function useIdentity(): IdentityState {
  const [state, setState] = useState<IdentityState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    getAuthenticatedIdentity()
      .then((identity) => {
        if (cancelled) return;
        setState(identity ? { status: "signed-in", identity } : { status: "anonymous" });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "anonymous" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
