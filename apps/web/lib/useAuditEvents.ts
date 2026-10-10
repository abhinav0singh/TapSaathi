"use client";

import { useEffect, useRef, useState } from "react";
import type { AuditEvent } from "@taapsaathi/contracts";
import { api } from "./api";

type Snapshot = { demoGeneration: number; events: AuditEvent[] };

export function useAuditEvents(
  demoGeneration: number | undefined,
  enabled: boolean,
  stopWhen?: (events: AuditEvent[]) => boolean
): AuditEvent[] {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const stopWhenRef = useRef(stopWhen);
  stopWhenRef.current = stopWhen;

  useEffect(() => {
    if (demoGeneration === undefined || !enabled) return;

    let mounted = true;
    let loading = false;
    let attempts = 0;
    let timer: number | undefined;

    async function refresh() {
      if (loading || attempts >= 12) return;
      loading = true;
      attempts += 1;
      try {
        const events = await api.allEvents();
        if (mounted && demoGeneration !== undefined) {
          setSnapshot({ demoGeneration, events });
          if (stopWhenRef.current?.(events) && timer !== undefined) {
            window.clearInterval(timer);
          }
        }
      } catch {
        // An unavailable audit endpoint must never imply an acknowledgment.
      } finally {
        loading = false;
        if (attempts >= 12 && timer !== undefined) window.clearInterval(timer);
      }
    }

    void refresh();
    timer = window.setInterval(() => void refresh(), 15000);
    return () => {
      mounted = false;
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [demoGeneration, enabled]);

  return snapshot && snapshot.demoGeneration === demoGeneration ? snapshot.events : [];
}
