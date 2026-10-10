"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DashboardResponse } from "@taapsaathi/contracts";
import AppNav from "@/components/AppNav";
import OperationsMap from "@/components/ops/OperationsMap";
import { api } from "@/lib/api";
import { latestSupervisorOutcome } from "@/lib/supervisorOutcome";
import { useAuditEvents } from "@/lib/useAuditEvents";
import { auditImpact } from "@/lib/auditImpact";
import { delhiArchiveWeatherDecision, delhiHistoricalDecision, delhiHistoricalReplay } from "@/lib/historicalHeatReplay";

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
    Boolean(data)
  );
  const displayedEvents = auditEvents.length > 0 && data
    ? auditEvents
        .filter((event) => event.demoGeneration === data.demoGeneration)
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        .slice(0, 50)
    : data?.recentEvents ?? [];
  const impact = data ? auditImpact(auditEvents, data.demoGeneration) : null;
  const formatDuration = (milliseconds: number | null) => milliseconds === null ? "Not yet recorded" : `${Math.round(milliseconds / 1000)} s`;

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
    <main className="min-h-screen bg-[#eef1ec] px-4 py-5 text-slate-900 md:px-8 md:py-7">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="relative flex flex-wrap items-start justify-between gap-7 overflow-hidden rounded-[2rem] bg-[#081411] p-6 text-white shadow-[0_25px_70px_rgba(8,20,17,.18)] md:p-8">
          <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[48px] border-orange-500/10" aria-hidden="true" />
          <div className="relative">
            <p className="text-xs font-bold tracking-[0.25em] text-orange-300">
              TAAPSAATHI
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-[-.035em] md:text-5xl">
              Intervention Command Center
            </h1>
            <p className="mt-3 text-sm text-white/55">
              {data?.hub.name ?? "Connecting to operations hub"}
            </p>
          </div>

          <div className="relative flex flex-col items-end gap-3">
            <AppNav />
            <div className="text-right">
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-2 text-xs font-semibold text-orange-200">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-300" />
                SIMULATED DEMO
              </span>
              <p className="mt-3 text-xs text-white/45">
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
                <div key={String(label)} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
                  <p className={`mt-3 text-3xl font-bold ${color}`}>
                    {value}
                  </p>
                </div>
              ))}
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-3xl border border-orange-200 bg-orange-50 p-6">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-700">Historical replay · not live weather</p>
                <h2 className="mt-2 text-lg font-bold">Delhi archive reanalysis value</h2>
                <p className="mt-2 text-sm text-slate-700">{delhiHistoricalReplay.observedAt} · {delhiHistoricalReplay.temperatureC}°C air · {delhiHistoricalReplay.apparentTemperatureC}°C apparent · {delhiHistoricalReplay.relativeHumidity}% humidity</p>
                <p className="mt-2 text-sm font-semibold text-orange-800">Weather alone: {delhiArchiveWeatherDecision.state} · {delhiArchiveWeatherDecision.matchedRule.replaceAll("_", " ")}. At the demo&apos;s 60-minute continuous-exposure limit: {delhiHistoricalDecision.state} · {delhiHistoricalDecision.matchedRule.replaceAll("_", " ")}.</p>
                <a className="mt-3 inline-block text-xs font-semibold underline" href={delhiHistoricalReplay.sourceUrl} target="_blank" rel="noreferrer">Source: {delhiHistoricalReplay.sourceName}</a>
                <p className="mt-2 text-xs text-slate-600">Requested point: {delhiHistoricalReplay.requestedLocation}; returned grid point: {delhiHistoricalReplay.gridPoint}. Retrieved {delhiHistoricalReplay.retrievedAt}. This fixed reanalysis value does not change the live demo or claim a current official alert.</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Audit-derived impact · full current-generation history</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><p><strong>{impact?.interventionCount ?? 0}</strong><br />interventions</p><p><strong>{impact?.escalationCount ?? 0}</strong><br />escalations</p><p><strong>{formatDuration(impact?.triggerToReassignmentMs ?? null)}</strong><br />trigger to reassignment</p><p><strong>{formatDuration(impact?.triggerToResponseMs ?? null)}</strong><br />trigger to worker response</p></div>
                <p className="mt-4 text-xs text-slate-500">Timings describe the first intervention in this generation. Operational timings only; rider wellbeing and medical outcomes are not inferred.</p>
              </div>
            </section>

            <section className="rounded-3xl border border-teal-200 bg-teal-50 p-6">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-800">Heat and water context · external survey</p>
              <h2 className="mt-2 text-lg font-bold">Why rest-point routing includes a water-and-shade goal</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">In a June 2024 Hyderabad survey by HeatWatch and the Telangana Gig and Platform Workers Union, 65% of surveyed gig workers called for clean water and toilets and 55% called for shaded rest areas. This supports the product direction; it is not a claim about Delhi, the simulated riders, or the facilities at this demo&apos;s seeded rest points.</p>
              <a className="mt-3 inline-block text-xs font-semibold underline" href="https://tgpwu.org/2024/08/17/impact-of-extreme-heat-on-gig-workers-a-survey-report/" target="_blank" rel="noreferrer">Read the 2024 TGPWU / HeatWatch survey</a>
              <p className="mt-2 text-xs text-slate-600">Demo rest points are simulated. Their names and routes do not verify real water, shade, toilet, or cooling availability.</p>
            </section>

            <OperationsMap
              hubName={data.hub.name}
              workers={data.workers}
              activeInterventions={data.activeInterventions}
              demoPending={pending}
              onStartDemo={() => void triggerHeatSpike()}
            />

            <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
              <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
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
                          ? "ACKNOWLEDGED · MAY RESUME"
                          : outcome?.status === "UNACKNOWLEDGED"
                            ? "RESPONSE OVERDUE"
                            : worker.state.replaceAll("_", " ")}
                      </span>
                    </Link>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
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
                    <button
                      disabled={pending}
                      onClick={() => void triggerHeatSpike()}
                      className="mt-5 min-h-12 rounded-xl bg-orange-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-50"
                    >
                      {pending ? "Processing..." : "Start intervention demo"}
                    </button>
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
              <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
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

              <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
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

            <section className="rounded-3xl border border-white/10 bg-[#081411] p-6 text-white shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">Demo controls</h2>
                  <p className="mt-1 text-xs text-white/50">
                    Simulated for demonstration. Uses real AWS backend workflows.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    disabled={pending}
                    onClick={() => void resetDemo()}
                    className="min-h-12 rounded-xl border border-white/20 px-5 text-sm font-semibold transition hover:bg-white/5 disabled:opacity-50"
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
