"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardResponse } from "@taapsaathi/contracts";
import SupervisorDesk, { type AckRecord } from "@/components/supervisor/SupervisorDesk";
import { api } from "@/lib/api";
import { getAuthenticatedIdentity } from "@/lib/auth";
import { latestAcknowledgmentBySupervisor } from "@/lib/supervisorOutcome";
import { useAuditEvents } from "@/lib/useAuditEvents";

type Accepted = {
  interventionId: string;
  workerId: string;
  acceptedAt: string;
  demoGeneration: number;
};

export default function SupervisorPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [supervisorId, setSupervisorId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Accepted | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await api.dashboard();
      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the supervisor queue.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    void getAuthenticatedIdentity()
      .then((identity) => {
        if (!identity || !identity.groups.includes("SUPERVISOR") || !identity.actorId) {
          throw new Error("Sign in with a configured supervisor account to acknowledge an escalation.");
        }
        setSupervisorId(identity.actorId);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to confirm supervisor identity.");
      });
  }, []);

  async function acknowledge(interventionId: string) {
    if (!supervisorId || pendingId) return;

    setPendingId(interventionId);
    setError(null);
    try {
      const response = await api.respond(interventionId, {
        actorId: supervisorId,
        actorType: "SUPERVISOR",
        action: "SUPERVISOR_ACK",
        clientRequestId: crypto.randomUUID(),
      });
      setAccepted({
        interventionId,
        workerId: data?.activeInterventions.find((item) => item.interventionId === interventionId)?.workerId ?? "",
        acceptedAt: response.acceptedAt,
        demoGeneration: data?.demoGeneration ?? -1,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The acknowledgment could not be recorded.");
    } finally {
      setPendingId(null);
    }
  }

  const auditEvents = useAuditEvents(
    data?.demoGeneration,
    Boolean(supervisorId && data?.workers.some((worker) => worker.state === "AWAITING_SUPERVISOR")),
    (events) =>
      Boolean(supervisorId && data && latestAcknowledgmentBySupervisor(events, supervisorId, data.demoGeneration)),
  );
  const fromAudit =
    supervisorId && data ? latestAcknowledgmentBySupervisor(auditEvents, supervisorId, data.demoGeneration) : null;

  const acceptedNow = accepted?.demoGeneration === data?.demoGeneration ? accepted : null;
  const recentAck: AckRecord | null = acceptedNow
    ? { workerId: acceptedNow.workerId, acceptedAt: acceptedNow.acceptedAt }
    : fromAudit
      ? { workerId: fromAudit.workerId, acceptedAt: fromAudit.occurredAt }
      : null;
  const acknowledgedIds = useMemo(
    () => new Set(acceptedNow ? [acceptedNow.interventionId] : []),
    [acceptedNow],
  );

  return (
    <SupervisorDesk
      data={data}
      supervisorId={supervisorId}
      error={error}
      lastUpdated={lastUpdated}
      pendingId={pendingId}
      acknowledgedIds={acknowledgedIds}
      recentAck={recentAck}
      onAcknowledge={(id) => void acknowledge(id)}
      onRefresh={() => void refresh()}
    />
  );
}
