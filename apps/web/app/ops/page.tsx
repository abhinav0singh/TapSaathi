"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DashboardResponse } from "@taapsaathi/contracts";
import AppNav from "@/components/AppNav";
import OperationsMap from "@/components/ops/OperationsMap";
import { api } from "@/lib/api";
import { latestSupervisorOutcome } from "@/lib/supervisorOutcome";
import { useAuditEvents } from "@/lib/useAuditEvents";

type Dashboard = DashboardResponse;

const statusStyles: Record<string, string> = {
  SAFE: "bg-emerald-50 text-emerald-700",
  CAUTION: "bg-amber-50 text-amber-700",
  HIGH: "bg-orange-50 text-orange-700",
  CRITICAL: "bg-red-50 text-red-700",
  RESTING: "bg-blue-50 text-blue-700",
  AWAITING_SUPERVISOR: "bg-violet-50 text-violet-700",
  ACKNOWLEDGED: "bg-emerald-50 text-emerald-700",
  UNACKNOWLEDGED: "bg-red-50 text-red-700",
};

const statusIcons: Record<string, string> = {
  SAFE: "✓",
  CAUTION: "!",
  HIGH: "!",
  CRITICAL: "!",
  RESTING: "Ⅱ",
  AWAITING_SUPERVISOR: "!",
  ACKNOWLEDGED: "✓",
  UNACKNOWLEDGED: "!",
};

export default function OperationsPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const auditEvents = useAuditEvents(
    data?.demoGeneration,
    Boolean(data && data.activeInterventions.length === 0 &&
      data.workers.some((worker) => worker.state === "AWAITING_SUPERVISOR")),
    (events) => Boolean(data && data.workers
      .filter((worker) => worker.state === "AWAITING_SUPERVISOR" && !worker.activeInterventionId)
      .every((worker) => latestSupervisorOutcome(events, worker.workerId, data.demoGeneration)))
  );
  const displayedEvents = auditEvents.length > 0 && data
    ? auditEvents
        .filter((event) => event.demoGeneration === data.demoGeneration)
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        .slice(0, 50)
    : data?.recentEvents ?? [];

  const refresh = useCallback(async () => {
    try {
      const result = await api.dashboard();
      setData(result);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reach backend.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const interval = setInterval(
      () => void refresh(),
      data?.activeInterventions.length ? 2000 : 5000
    );

    return () => clearInterval(interval);
  }, [refresh, data?.activeInterventions.length]);

  async function triggerHeatSpike() {
    if (pending) return;

    setPending(true);
    setError(null);

    try {
      await api.heatSpike();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Heat spike failed.");
    } finally {
      setPending(false);
    }
  }

  async function resetDemo() {
    if (pending) return;
    if (!window.confirm("Reset the simulated demo state?")) return;

    setPending(true);
    setError(null);

    try {
      await api.reset();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-6 text-slate-900 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-orange-600">
              TAAPSAATHI
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Intervention Command Center
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {data?.hub.name ?? "Connecting to operations hub"}
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            <AppNav />
            <div className="text-right">
              <span className="rounded-full bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800">
                SIMULATED DEMO
              </span>
              <p className="mt-3 text-xs text-slate-500">
                {lastRefresh
                  ? `Last refreshed ${lastRefresh.toLocaleTimeString()}`
                  : "Waiting for first refresh"}
              </p>
            </div>
          </div>
        </header>

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
            <button onClick={() => void refresh()} className="ml-3 font-bold underline">
              Retry
            </button>
          </div>
        )}

        {!data ? (
          <div className="rounded-2xl bg-white p-10 text-center text-slate-500">
            Loading live operations data...
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ["Safe workers", data.summary.safe, "text-emerald-600"],
                ["Caution", data.summary.caution, "text-amber-600"],
                ["Interventions", data.summary.intervention, "text-orange-600"],
                ["Needs follow-up", data.summary.awaitingSupervisor, "text-violet-600"],
              ].map(([label, value, color]) => (
                <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
                  <p className={`mt-3 text-3xl font-bold ${color}`}>
                    {value}
                  </p>
                </div>
              ))}
            </section>

            <OperationsMap
              hubName={data.hub.name}
              workers={data.workers}
              activeInterventions={data.activeInterventions}
            />

            <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold">Worker roster</h2>
                <p className="mb-5 text-xs text-slate-500">
                  Live backend-reported safety states
                </p>

                <div className="space-y-3">
                  {data.workers.map((worker) => {
                    const outcome = worker.state === "AWAITING_SUPERVISOR" && !worker.activeInterventionId
                      ? latestSupervisorOutcome(auditEvents, worker.workerId, data.demoGeneration)
                      : null;
                    const displayStatus = outcome?.status === "ACKNOWLEDGED"
                      ? "ACKNOWLEDGED"
                      : outcome?.status === "UNACKNOWLEDGED"
                        ? "UNACKNOWLEDGED"
                        : worker.state;
                    return (
                    <Link
                      key={worker.workerId}
                      href={`/worker/${worker.workerId}`}
                      className="flex items-center justify-between rounded-xl border border-slate-100 p-4 transition hover:border-slate-200 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-orange-600"
                    >
                      <div>
                        <p className="font-semibold">{worker.name}</p>
                        <p className="text-xs text-slate-500">
                          {worker.activeMinutes} active minutes
                        </p>
                      </div>

                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyles[displayStatus] ?? "bg-slate-100"}`}>
                        {statusIcons[displayStatus] ?? "•"} {outcome?.status === "ACKNOWLEDGED"
                          ? "ACKNOWLEDGED · NOT CLEARED"
                          : outcome?.status === "UNACKNOWLEDGED"
                            ? "RESPONSE OVERDUE"
                            : worker.state.replaceAll("_", " ")}
                      </span>
                    </Link>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold">Intervention lifecycle</h2>
                <p className="mb-5 text-xs text-slate-500">
                  AWS Step Functions workflow
                </p>

                {data.activeInterventions.length === 0 ? (
                  <div className="flex min-h-52 flex-col items-center justify-center rounded-xl bg-slate-50 text-center">
                    <p className="text-lg font-semibold">No active intervention</p>
                    <p className="mt-2 text-sm text-slate-500">
                      Trigger a simulated heat spike to begin.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.activeInterventions.map((item) => (
                      <div key={item.interventionId} className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                        <p className="text-xs font-bold text-orange-700">
                          {item.riskLevel} RISK
                        </p>
                        <h3 className="mt-2 font-semibold">{data.workers.find((worker) => worker.workerId === item.workerId)?.name ?? item.workerId}</h3>
                        <p className="mt-2 text-sm">
                          Workflow: {item.status.replaceAll("_", " ")}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Matched rule: {item.matchedRule}
                        </p>
                        {item.route && (
                          <p className="mt-3 text-sm">
                            Rest point: {item.route.restPointName}
                            {" · "}
                            {item.route.distanceMeters} m
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold">Delivery assignments</h2>

                <div className="mt-4 space-y-3">
                  {data.tasks.map((task) => (
                    <div key={task.taskId} className="flex flex-wrap justify-between gap-3 rounded-xl bg-slate-50 p-4">
                      <div>
                        <p className="font-semibold">{task.taskId}</p>
                        <p className="text-xs text-slate-500">{task.status}</p>
                      </div>
                      <p className="text-sm font-semibold">
                        {data.workers.find((worker) => worker.workerId === task.assigneeId)?.name ?? "Unassigned"}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold">Audit timeline</h2>

                <div className="mt-4 max-h-72 space-y-3 overflow-y-auto">
                  {displayedEvents.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No audit events recorded yet.
                    </p>
                  ) : (
                    displayedEvents.map((event) => (
                      <div key={event.auditEventId} className="border-l-2 border-orange-400 pl-4">
                        <p className="text-sm font-semibold">{event.eventType}</p>
                        <p className="text-xs text-slate-500">
                          {event.workerId} · {new Date(event.occurredAt).toLocaleTimeString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">Demo controls</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Simulated for demonstration. Uses real AWS backend workflows.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    disabled={pending}
                    onClick={() => void resetDemo()}
                    className="min-h-12 rounded-xl border border-slate-300 px-5 text-sm font-semibold disabled:opacity-50"
                  >
                    Reset demo
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => void triggerHeatSpike()}
                    className="min-h-12 rounded-xl bg-orange-600 px-5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {pending ? "Processing..." : "Trigger simulated heat spike"}
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
