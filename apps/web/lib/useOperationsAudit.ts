"use client";

import { useEffect, useState } from "react";
import type { AuditEvent } from "@taapsaathi/contracts";
import { api } from "./api";

export type OperationsAuditState =
  | { status: "loading"; events: null }
  | { status: "unavailable"; events: null }
  | { status: "loaded"; events: AuditEvent[]; stale: boolean };

type Snapshot = OperationsAuditState & {
  demoGeneration: number;
};

export const OPERATIONS_AUDIT_INTERVAL_MS = 15000;
export const shouldRefreshOperationsAudit = (visibilityState: DocumentVisibilityState) => visibilityState !== "hidden";

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
  publish: (snapshot: Snapshot) => void,
  previousEvents: AuditEvent[] | null = null
): Promise<void> {
  try {
    const events = await fetchEvents();
    publish({ demoGeneration, status: "loaded", events, stale: false });
  } catch {
    publish(previousEvents
      ? { demoGeneration, status: "loaded", events: previousEvents, stale: true }
      : { demoGeneration, status: "unavailable", events: null });
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
      stale: snapshot.stale,
    };
  }

  return {
    status: snapshot.status,
    events: null,
  };
}

export function createOperationsAuditRefresher(
  demoGeneration: number,
  fetchEvents: () => Promise<AuditEvent[]>,
  publish: (snapshot: Snapshot) => void
) {
  let loading = false;
  let mounted = true;
  let previousEvents: AuditEvent[] | null = null;
  return {
    async refresh() {
      if (loading || !mounted) return;
      loading = true;
      try {
        await refreshOperationsAudit(demoGeneration, fetchEvents, (snapshot) => {
          if (snapshot.status === "loaded") previousEvents = snapshot.events;
          if (mounted) publish(snapshot);
        }, previousEvents);
      } finally { loading = false; }
    },
    dispose() { mounted = false; },
  };
}

export function useOperationsAudit(
  demoGeneration: number | undefined,
  enabled: boolean
): OperationsAuditState {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    if (demoGeneration === undefined || !enabled) return;

    const refresher = createOperationsAuditRefresher(demoGeneration, () => api.allEvents(), setSnapshot);
    const refresh = () => {
      if (shouldRefreshOperationsAudit(document.visibilityState)) void refresher.refresh();
    };

    const stopPolling = startOperationsAuditPolling(
      () => void refresh(),
      (callback, interval) => window.setInterval(callback, interval),
      (timer) => window.clearInterval(timer)
    );

    return () => {
      refresher.dispose();
      stopPolling();
    };
  }, [demoGeneration, enabled]);

  return operationsAuditView(snapshot, demoGeneration);
}
