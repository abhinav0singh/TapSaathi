"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DashboardResponse, Intervention } from "@taapsaathi/contracts";
import AppNav from "@/components/AppNav";
import { api } from "@/lib/api";

function waitingForSupervisor(intervention: Intervention) {
  return ["AWAITING_SUPERVISOR", "SUPERVISOR_UNACKNOWLEDGED"].includes(intervention.status);
}

export default function SupervisorPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [supervisorId, setSupervisorId] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(() => new Set());
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

  async function acknowledge(interventionId: string) {
    if (!supervisorId.trim() || pendingId) return;

    setPendingId(interventionId);
    setError(null);
    try {
      await api.respond(interventionId, {
        actorId: supervisorId.trim(),
        actorType: "SUPERVISOR",
        action: "SUPERVISOR_ACK",
        clientRequestId: crypto.randomUUID(),
      });
      setAcknowledgedIds((current) => new Set(current).add(interventionId));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Acknowledgment could not be submitted.");
    } finally {
      setPendingId(null);
    }
  }

  const queue = data?.activeInterventions.filter(waitingForSupervisor) ?? [];

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-6 text-slate-900 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-orange-600">TAAPSAATHI</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Supervisor response desk</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-600">
              Review heat-safety escalations and record supervisor acknowledgment. Actions are submitted through your authenticated Cognito session.
            </p>
          </div>
          <AppNav supervisorOnly />
        </header>

        {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <label htmlFor="supervisor-id" className="text-sm font-bold">Supervisor ID</label>
            <p className="mt-1 text-sm text-slate-500">Use your assigned identity; it is recorded in the audit trail.</p>
            <input
              id="supervisor-id"
              value={supervisorId}
              onChange={(event) => setSupervisorId(event.target.value)}
              autoComplete="username"
              placeholder="Your authenticated supervisor ID"
              className="mt-3 min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none transition focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
            />
          </div>
          <button onClick={() => void refresh()} className="min-h-12 rounded-xl border border-slate-300 px-5 text-sm font-bold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-orange-600">
            Refresh queue
          </button>
        </section>

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
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-10 text-center">
              <p className="text-lg font-bold text-emerald-900">No acknowledgment is currently required</p>
              <p className="mt-2 text-sm text-emerald-800">New escalations will appear here automatically.</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {queue.map((intervention) => {
                const worker = data.workers.find((candidate) => candidate.workerId === intervention.workerId);
                const acknowledged = acknowledgedIds.has(intervention.interventionId);
                return (
                  <article key={intervention.interventionId} className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
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
                        disabled={!supervisorId.trim() || pendingId !== null}
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
