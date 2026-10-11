"use client";

import { useEffect, useState } from "react";
import { getAuthenticatedIdentity, type AuthenticatedIdentity } from "@/lib/auth";

export type IdentityState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "signed-in"; identity: AuthenticatedIdentity };

let inflight: Promise<AuthenticatedIdentity | null> | null = null;

/**
 * One session read serves every component that asks while it is in flight. The header, the route
 * guard and the page all call useIdentity on the same load; without this each would hit Cognito
 * (and could each trigger a token refresh) separately.
 */
function readIdentity(): Promise<AuthenticatedIdentity | null> {
  inflight ??= getAuthenticatedIdentity().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Reads the current Cognito session once on mount. Errors count as signed out. */
export function useIdentity(): IdentityState {
  const [state, setState] = useState<IdentityState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    readIdentity()
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
