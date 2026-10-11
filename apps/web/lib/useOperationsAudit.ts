"use client";

import { useEffect, useState } from "react";
import type { AuditEvent } from "@taapsaathi/contracts";
import { api } from "./api";

export type OperationsAuditState =
  | { status: "loading"; events: null }
  | { status: "unavailable"; events: null }
  | { status: "loaded"; events: AuditEvent[] };

type Snapshot = OperationsAuditState & {
  demoGeneration: number;
};

export const OPERATIONS_AUDIT_INTERVAL_MS = 15000;

export function startOperationsAuditPolling(
  refresh: () => void,
  schedule: (callback: () => void, interval: number) => number,
  cancel: (timer: number) => void
): () => void {
  refresh();
  const timer = schedule(refresh, OPERATIONS_AUDIT_INTERVAL_MS);
  return () => cancel(timer);
}

export async function refreshOperationsAudit(
  demoGeneration: number,
  fetchEvents: () => Promise<AuditEvent[]>,
  publish: (snapshot: Snapshot) => void
): Promise<void> {
  try {
    const events = await fetchEvents();
    publish({ demoGeneration, status: "loaded", events });
  } catch {
    publish({ demoGeneration, status: "unavailable", events: null });
  }
}
export function operationsAuditView(
  snapshot: Snapshot | null,
  demoGeneration: number | undefined
): OperationsAuditState {
  if (
    demoGeneration === undefined ||
    snapshot?.demoGeneration !== demoGeneration
  ) {
    return { status: "loading", events: null };
  }

  if (snapshot.status === "loaded") {
    return {
      status: "loaded",
      events: snapshot.events,
    };
  }

  return {
    status: snapshot.status,
    events: null,
  };
}

export function useOperationsAudit(
  demoGeneration: number | undefined,
  enabled: boolean
): OperationsAuditState {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    if (demoGeneration === undefined || !enabled) return;

    let mounted = true;
    let loading = false;

    async function refresh() {
      if (loading) return;
      loading = true;

      try {
        await refreshOperationsAudit(
          demoGeneration!,
          () => api.allEvents(),
          (nextSnapshot) => {
            if (mounted) setSnapshot(nextSnapshot);
          }
        );
      } finally {
        loading = false;
      }
    }

    const stopPolling = startOperationsAuditPolling(
      () => void refresh(),
      (callback, interval) => window.setInterval(callback, interval),
      (timer) => window.clearInterval(timer)
    );

    return () => {
      mounted = false;
      stopPolling();
    };
  }, [demoGeneration, enabled]);

  return operationsAuditView(snapshot, demoGeneration);
}
