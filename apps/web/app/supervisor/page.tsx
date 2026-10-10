"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DashboardResponse, Intervention } from "@taapsaathi/contracts";
import AppNav from "@/components/AppNav";
import { api } from "@/lib/api";
import { getAuthenticatedIdentity } from "@/lib/auth";
import { latestAcknowledgmentBySupervisor } from "@/lib/supervisorOutcome";
import { useAuditEvents } from "@/lib/useAuditEvents";

function waitingForSupervisor(intervention: Intervention) {
  return ["AWAITING_SUPERVISOR", "SUPERVISOR_UNACKNOWLEDGED"].includes(intervention.status);
}

export default function SupervisorPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [supervisorId, setSupervisorId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [acceptedAcknowledgment, setAcceptedAcknowledgment] = useState<{
    interventionId: string;
    workerId: string;
    acceptedAt: string;
    demoGeneration: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await api.dashboard();
      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load supervisor queue.");
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
      setAcceptedAcknowledgment({
        interventionId,
        workerId: data?.activeInterventions.find((item) => item.interventionId === interventionId)?.workerId ?? "",
        acceptedAt: response.acceptedAt,
        demoGeneration: data?.demoGeneration ?? -1,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Acknowledgment could not be submitted.");
    } finally {
      setPendingId(null);
    }
  }

  const queue = data?.activeInterventions.filter(waitingForSupervisor) ?? [];
  const auditEvents = useAuditEvents(
    data?.demoGeneration,
    Boolean(supervisorId && data?.workers.some((worker) => worker.state === "AWAITING_SUPERVISOR")),
    (events) => Boolean(supervisorId && data &&
      latestAcknowledgmentBySupervisor(events, supervisorId, data.demoGeneration))
  );
  const recentAcknowledgment = supervisorId && data
    ? latestAcknowledgmentBySupervisor(auditEvents, supervisorId, data.demoGeneration)
    : null;
  const visibleAcknowledgment = acceptedAcknowledgment?.demoGeneration === data?.demoGeneration
    ? acceptedAcknowledgment
    : recentAcknowledgment
      ? {
          workerId: recentAcknowledgment.workerId,
          acceptedAt: recentAcknowledgment.occurredAt,
        }
      : null;

  return (
    <main className="min-h-screen bg-[#eef1ec] px-4 py-5 text-slate-900 md:px-8 md:py-7">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="relative flex flex-wrap items-start justify-between gap-7 overflow-hidden rounded-[2rem] bg-[#081411] p-6 text-white shadow-[0_25px_70px_rgba(8,20,17,.18)] md:p-8">
          <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[48px] border-violet-500/15" aria-hidden="true" />
          <div className="relative">
            <p className="text-xs font-bold tracking-[0.25em] text-orange-300">TAAPSAATHI</p>
            <h1 className="mt-3 text-3xl font-black tracking-[-.035em] md:text-5xl">Supervisor response desk</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/55">
              Review heat-safety escalations and record supervisor acknowledgment. Actions are submitted through your authenticated Cognito session.
            </p>
          </div>
          <div className="relative"><AppNav /></div>
        </header>

        {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

        <section className="grid gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-sm font-bold">Authenticated supervisor</p>
            <p className="mt-1 text-sm text-slate-500">Your signed-in identity is used for the audit trail.</p>
            <p className="mt-3 min-h-12 rounded-xl border border-slate-200 bg-[#f7f8f4] px-4 py-3 text-sm font-semibold text-slate-800" aria-live="polite">
              {supervisorId ?? "Confirming your Cognito identity…"}
            </p>
          </div>
          <button onClick={() => void refresh()} className="min-h-12 rounded-xl border border-slate-300 px-5 text-sm font-bold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-orange-600">
            Refresh queue
          </button>
        </section>

        {visibleAcknowledgment && (
          <section role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
            <h2 className="text-lg font-bold">Supervisor acknowledgment recorded</h2>
            <p className="mt-2 text-sm">
              {data?.workers.find((worker) => worker.workerId === visibleAcknowledgment.workerId)?.name ?? visibleAcknowledgment.workerId}
              {" · "}
              {new Date(visibleAcknowledgment.acceptedAt).toLocaleTimeString()}
            </p>
            <p className="mt-2 text-sm">The response was accepted. The rider can resume work after confirming they feel well enough.</p>
          </section>
        )}

        <section aria-labelledby="queue-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="queue-title" className="text-xl font-bold">Awaiting acknowledgment</h2>
              <p className="mt-1 text-sm text-slate-500">{queue.length} live item{queue.length === 1 ? "" : "s"} in the supervisor queue.</p>
            </div>
            <p className="text-xs text-slate-500">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Loading live queue…"}</p>
          </div>

          {!data ? (
            <div className="rounded-2xl bg-white p-10 text-center text-slate-500">Loading live supervisor queue…</div>
          ) : queue.length === 0 ? (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-12 text-center shadow-sm">
              <p className="text-lg font-bold text-emerald-900">No acknowledgment is currently required</p>
              <p className="mt-2 text-sm text-emerald-800">New escalations will appear here automatically.</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {queue.map((intervention) => {
                const worker = data.workers.find((candidate) => candidate.workerId === intervention.workerId);
                const acknowledged = acceptedAcknowledgment?.interventionId === intervention.interventionId &&
                  acceptedAcknowledgment.demoGeneration === data.demoGeneration;
                return (
                  <article key={intervention.interventionId} className="rounded-3xl border border-violet-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold tracking-[0.14em] text-violet-700">SUPERVISOR ACTION REQUIRED</p>
                        <h3 className="mt-2 text-xl font-bold">{worker?.name ?? intervention.workerId}</h3>
                        <p className="mt-1 text-sm text-slate-600">{intervention.riskLevel} risk · {intervention.status.replaceAll("_", " ")}</p>
                      </div>
                      <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800">Escalation</span>
                    </div>
                    <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                      <div><dt className="text-slate-500">Reason</dt><dd className="mt-1 font-semibold">{intervention.escalationReason?.replaceAll("_", " ") ?? "Supervisor review"}</dd></div>
                      <div><dt className="text-slate-500">Active time</dt><dd className="mt-1 font-semibold">{worker?.activeMinutes ?? "—"} min</dd></div>
                      <div><dt className="text-slate-500">Intervention</dt><dd className="mt-1 break-all font-mono text-xs">{intervention.interventionId}</dd></div>
                      <div><dt className="text-slate-500">Started</dt><dd className="mt-1 font-semibold">{new Date(intervention.createdAt).toLocaleTimeString()}</dd></div>
                    </dl>
                    {acknowledged ? (
                      <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Acknowledgment accepted. Waiting for the live workflow to update.</p>
                    ) : (
                      <button
                        type="button"
                        disabled={!supervisorId || pendingId !== null}
                        onClick={() => void acknowledge(intervention.interventionId)}
                        className="mt-5 min-h-12 w-full rounded-xl bg-violet-700 px-4 font-bold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700"
                      >
                        {pendingId === intervention.interventionId ? "Submitting acknowledgment…" : "Supervisor acknowledge"}
                      </button>
                    )}
                    <Link href={`/worker/${intervention.workerId}`} className="mt-4 inline-block text-sm font-semibold text-slate-700 underline underline-offset-4 hover:text-slate-950">View rider safety screen</Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
