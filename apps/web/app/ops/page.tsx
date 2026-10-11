"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleCheck, ExternalLink, OctagonAlert, TriangleAlert } from "lucide-react";
import type { DashboardResponse } from "@taapsaathi/contracts";
import DeskHeader from "@/components/shell/DeskHeader";
import OperationsMap from "@/components/ops/OperationsMap";
import DemoControls from "@/components/ops/DemoControls";
import StageList from "@/components/ops/StageList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STATE_META, TONE_CIRCLE, TONE_PILL, urgencyRank, type StateTone } from "@/components/status/stateMeta";
import { api } from "@/lib/api";
import { supervisorFollowUpForWorker } from "@/lib/supervisorFollowUp";
import { useOperationsAudit } from "@/lib/useOperationsAudit";
import { auditImpact } from "@/lib/auditImpact";
import { eventText } from "@/lib/auditText";
import { ago, clockWithSeconds, dateTime } from "@/lib/time";
import { humanize } from "@/lib/humanize";
import { useNow } from "@/lib/useNow";
import { cn } from "@/lib/utils";
import { delhiArchiveWeatherDecision, delhiHistoricalDecision, delhiHistoricalReplay } from "@/lib/historicalHeatReplay";

type Dashboard = DashboardResponse;
type Worker = Dashboard["workers"][number];

const ACTOR_LABEL = { SYSTEM: "System", WORKER: "Rider", SUPERVISOR: "Supervisor" } as const;

/** Numbers get large type; words ("Loading", "Not yet recorded") stay small so they never shout. */
function Stat({ value, label }: { value: string; label: string }) {
  const numeric = /^\d/.test(value);
  return (
    <div>
      <p className={cn("tabular-nums", numeric ? "text-[1.5rem] font-medium leading-none tracking-tight" : "text-[0.9375rem] leading-[1.5rem] text-label-2")}>
        {numeric ? value : value === "Not yet recorded" ? "Not recorded yet" : value}
      </p>
      <p className="mt-2 text-[0.8125rem] text-label-2">{label}</p>
    </div>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-[1.25rem] font-medium leading-none tracking-tight tabular-nums">{value}</p>
      <p className="mt-1.5 text-[0.8125rem] text-label-2">{label}</p>
    </div>
  );
}

export default function OperationsPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const now = useNow(1000);

  const audit = useOperationsAudit(data?.demoGeneration, Boolean(data));
  const auditEvents = useMemo(() => audit.events ?? [], [audit.events]);
  const followUpEvents = audit.status === "loaded" ? auditEvents : (data?.recentEvents ?? []);
  const displayedEvents =
    audit.status === "loaded" && data && auditEvents.length > 0
      ? auditEvents
          .filter((event) => event.demoGeneration === data.demoGeneration)
          .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
          .slice(0, 50)
      : (data?.recentEvents ?? []);
  const impact = data && audit.status === "loaded" ? auditImpact(auditEvents, data.demoGeneration) : null;
  const impactValue = (value: number | undefined) =>
    audit.status === "loading" ? "Loading" : audit.status === "unavailable" ? "Unavailable" : String(value ?? 0);
  const formatDuration = (milliseconds: number | null) =>
    milliseconds === null ? "Not yet recorded" : `${Math.round(milliseconds / 1000)} s`;
  const impactDuration = (value: number | null | undefined) =>
    audit.status === "loading" ? "Loading" : audit.status === "unavailable" ? "Unavailable" : formatDuration(value ?? null);

  const refresh = useCallback(async () => {
    try {
      const result = await api.dashboard();
      setData(result);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reach the backend.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const interval = setInterval(() => void refresh(), data?.activeInterventions.length ? 2000 : 5000);
    return () => clearInterval(interval);
  }, [refresh, data?.activeInterventions.length]);

  const nameOf = useCallback(
    (workerId: string) => data?.workers.find((worker) => worker.workerId === workerId)?.name ?? workerId,
    [data],
  );

  const primary = data?.activeInterventions[0] ?? null;
  const followUps = useMemo(
    () =>
      data
        ? data.workers.flatMap((worker) => {
            const followUp = supervisorFollowUpForWorker(worker, followUpEvents, data.demoGeneration);
            return followUp ? [{ ...followUp, riderName: worker.name }] : [];
          })
        : [],
    [data, followUpEvents],
  );
  const primaryFollowUp =
    followUps.find((followUp) => followUp.status === "UNACKNOWLEDGED") ?? followUps[0] ?? null;
  const selected = data?.workers.find(
    (worker) => worker.workerId === (selectedId ?? primary?.workerId ?? primaryFollowUp?.workerId),
  ) ?? null;

  const roster = useMemo(() => {
    if (!data) return [];
    return [...data.workers]
      .sort((a, b) => urgencyRank(a.state) - urgencyRank(b.state) || a.name.localeCompare(b.name))
      .map((worker) => {
        const outcome = supervisorFollowUpForWorker(worker, followUpEvents, data.demoGeneration);
        const meta = STATE_META[worker.state];
        let tone: StateTone = meta.tone;
        let Icon = meta.icon;
        let label = meta.short.en;
        if (outcome?.status === "ACKNOWLEDGED") {
          tone = "rest";
          Icon = CircleCheck;
          label = "Acknowledged, may resume";
        } else if (outcome?.status === "UNACKNOWLEDGED") {
          tone = "critical";
          Icon = OctagonAlert;
          label = "Supervisor follow-up overdue";
        }
        return { worker, tone, Icon, label };
      });
  }, [data, followUpEvents]);

  const overdueWorkerIds = useMemo(
    () => followUps.filter((followUp) => followUp.status === "UNACKNOWLEDGED").map((followUp) => followUp.workerId),
    [followUps],
  );

  const taskOwner = (assigneeId: string | null) => (assigneeId ? nameOf(assigneeId) : "Nobody yet");

  return (
    <div className="min-h-dvh bg-canvas">
      <DeskHeader />

      <main className="mx-auto max-w-[88rem] px-4 pb-16 pt-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[1.625rem] font-semibold tracking-tight">Operations workspace</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.9375rem] text-label-2">
              <span>{data?.hub.name ?? "Connecting to the hub…"}</span>
              <span className="rounded-full bg-wait-tint px-2.5 py-0.5 text-[0.8125rem] font-medium text-wait-ink">
                Sandbox data
              </span>
              <span className="text-[0.875rem]" suppressHydrationWarning>
                {lastRefresh && now !== null ? `Updated ${ago(now - lastRefresh.getTime())}` : ""}
              </span>
            </p>
          </div>
          <p className="max-w-xs text-[0.8125rem] leading-relaxed text-label-2 sm:text-right">This authenticated workspace displays deployment-backed sandbox data. The interactive walkthrough on Home is separate and cannot change it.</p>
        </div>

        <DemoControls onChanged={() => void refresh()} />

        {error && (
          <p role="alert" className="mt-5 flex items-start gap-3 rounded-2xl bg-critical-tint px-4 py-3.5 text-[0.9375rem] text-critical-ink">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button type="button" onClick={() => void refresh()} className="font-medium underline underline-offset-4">
              Try again
            </button>
          </p>
        )}

        {!data ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-[26rem_minmax(0,1fr)]" aria-busy="true">
            <div className="h-96 animate-pulse rounded-3xl bg-surface" />
            <div className="h-96 animate-pulse rounded-3xl bg-surface" />
          </div>
        ) : (
          <>
            <div className="mt-8 grid items-start gap-6 lg:grid-cols-[26rem_minmax(0,1fr)]">
              <div className="space-y-6">
                <StageList
                  intervention={primary}
                  riderName={primary ? nameOf(primary.workerId) : ""}
                  followUp={primaryFollowUp}
                  more={Math.max(0, data.activeInterventions.length - 1)}
                  now={now}
                />

                <section aria-label="Riders" className="rounded-3xl bg-surface p-2">
                  <h2 className="px-4 pb-1 pt-3 text-[0.9375rem] font-medium text-label-2">Riders</h2>
                  <ul>
                    {roster.map(({ worker, tone, Icon, label }) => (
                      <RiderRow
                        key={worker.workerId}
                        worker={worker}
                        tone={tone}
                        Icon={Icon}
                        label={label}
                        selected={selected?.workerId === worker.workerId}
                        onSelect={() => setSelectedId(worker.workerId)}
                      />
                    ))}
                  </ul>
                  {selected && (
                    <Link
                      href={`/worker/${selected.workerId}`}
                      className="mx-4 mb-3 mt-1 inline-flex min-h-10 items-center gap-1.5 text-[0.9375rem] text-rest underline-offset-4 hover:underline"
                    >
                      See what {selected.name} sees
                      <ExternalLink aria-hidden="true" className="size-3.5" />
                    </Link>
                  )}
                </section>
              </div>

              <div className="space-y-6">
                <OperationsMap
                  hubName={data.hub.name}
                  workers={data.workers}
                  activeInterventions={data.activeInterventions}
                  overdueWorkerIds={overdueWorkerIds}
                  selectedId={selected?.workerId ?? null}
                  onSelect={setSelectedId}
                  className="h-[28rem] lg:h-[34rem]"
                />

                <section aria-label="Deliveries" className="rounded-3xl bg-surface p-2">
                  <h2 className="px-4 pb-1 pt-3 text-[0.9375rem] font-medium text-label-2">Deliveries</h2>
                  <ul>
                    {data.tasks.map((task) => (
                      <li key={task.taskId} className="flex items-center justify-between gap-4 rounded-2xl px-4 py-3">
                        <div>
                          <p className="text-[1rem] font-medium">{task.taskId}</p>
                          <p className="text-[0.875rem] text-label-2">
                            {task.status === "REASSIGNMENT_REQUIRED" ? "Needs reassignment" : task.status === "COMPLETED" ? "Completed" : "Assigned"}
                          </p>
                        </div>
                        <p className={cn("text-[0.9375rem]", task.status === "REASSIGNMENT_REQUIRED" ? "font-medium text-critical-ink" : "text-label-2")}>
                          {taskOwner(task.assigneeId)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>

            <section className="mt-6 rounded-3xl bg-surface p-6 sm:p-8">
              <Tabs defaultValue="audit">
                <TabsList>
                  <TabsTrigger value="audit">Audit trail</TabsTrigger>
                  <TabsTrigger value="impact">Impact</TabsTrigger>
                  <TabsTrigger value="context">Context</TabsTrigger>
                </TabsList>

                <TabsContent value="audit" className="pt-4">
                  {audit.status === "loaded" && audit.stale && (
                    <p role="status" className="mb-3 text-[0.875rem] text-caution-ink">
                      Showing the last loaded audit history; refresh is temporarily unavailable.
                    </p>
                  )}
                  {audit.status === "unavailable" && (
                    <p role="status" className="mb-3 text-[0.875rem] text-caution-ink">
                      Audit history is temporarily unavailable.
                    </p>
                  )}
                  {displayedEvents.length === 0 ? (
                    <p className="text-[0.9375rem] text-label-2">Nothing has been recorded yet. Start a heat spike to see events appear.</p>
                  ) : (
                    <ol className="max-h-80 space-y-1 overflow-y-auto pr-2">
                      {displayedEvents.map((event) => (
                        <li key={event.auditEventId} className="flex items-baseline gap-4 rounded-xl px-1 py-2">
                          <span className="w-[5.5rem] shrink-0 text-[0.8125rem] tabular-nums text-label-2 sm:w-24 sm:text-[0.875rem]" suppressHydrationWarning>
                            {clockWithSeconds(new Date(event.occurredAt))}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[1rem] leading-snug">{eventText(event, nameOf(event.workerId))}</span>
                            <span className="block text-[0.8125rem] text-label-2 sm:hidden">{ACTOR_LABEL[event.actorType]}</span>
                          </span>
                          <span className="hidden shrink-0 text-[0.8125rem] text-label-2 sm:block">{ACTOR_LABEL[event.actorType]}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </TabsContent>

                <TabsContent value="impact" className="pt-6">
                  <div className="grid max-w-3xl grid-cols-2 gap-x-10 gap-y-7 sm:grid-cols-4">
                    <Stat value={impactValue(impact?.interventionCount)} label="Alerts" />
                    <Stat value={impactValue(impact?.escalationCount)} label="Escalations" />
                    <Stat value={impactDuration(impact?.triggerToReassignmentMs)} label="Alert to delivery handover" />
                    <Stat value={impactDuration(impact?.triggerToResponseMs)} label="Alert to rider reply" />
                  </div>
                  <p className="mt-6 max-w-2xl text-[0.875rem] leading-relaxed text-label-2">
                    {audit.status === "loaded" && audit.stale ? "Showing the last loaded history; refresh is temporarily unavailable. " : ""}
                    Derived from the audit history of the current demo run. Timings describe the first alert in this run. They measure operations only; rider wellbeing and medical outcomes are not inferred.
                  </p>
                </TabsContent>

                <TabsContent value="context" className="grid gap-12 pt-7 lg:grid-cols-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-[1.0625rem] font-semibold">Historical replay</h3>
                      <span className="rounded-full bg-wait-tint px-2.5 py-0.5 text-[0.8125rem] font-medium text-wait-ink">Not live weather</span>
                    </div>
                    <p className="mt-1 text-[0.9375rem] text-label-2">Delhi, {dateTime(new Date(delhiHistoricalReplay.observedAt))}</p>

                    <div className="mt-5 grid grid-cols-3 gap-6">
                      <Fact value={`${delhiHistoricalReplay.temperatureC}°C`} label="Air" />
                      <Fact value={`${delhiHistoricalReplay.apparentTemperatureC}°C`} label="Feels like" />
                      <Fact value={`${delhiHistoricalReplay.relativeHumidity}%`} label="Humidity" />
                    </div>

                    <ul className="mt-6 space-y-2.5 text-[0.9375rem]">
                      <li className="flex items-center justify-between gap-4">
                        <span>Weather alone</span>
                        <span className={cn("rounded-full px-2.5 py-1 text-[0.8125rem] font-medium", delhiArchiveWeatherDecision.state === "SAFE" ? TONE_PILL.safe : delhiArchiveWeatherDecision.state === "CAUTION" ? TONE_PILL.caution : TONE_PILL.high)}>
                          {humanize(delhiArchiveWeatherDecision.state)}
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-4">
                        <span>After 60 minutes of continuous riding</span>
                        <span className={cn("rounded-full px-2.5 py-1 text-[0.8125rem] font-medium", delhiHistoricalDecision.state === "SAFE" ? TONE_PILL.safe : delhiHistoricalDecision.state === "CAUTION" ? TONE_PILL.caution : TONE_PILL.high)}>
                          {humanize(delhiHistoricalDecision.state)}
                        </span>
                      </li>
                    </ul>

                    <p className="mt-6 max-w-prose text-[0.8125rem] leading-relaxed text-label-2">
                      A fixed reanalysis value from{" "}
                      <a className="text-rest underline underline-offset-4" href={delhiHistoricalReplay.sourceUrl} target="_blank" rel="noreferrer">
                        {delhiHistoricalReplay.sourceName}
                      </a>
                      , retrieved {delhiHistoricalReplay.retrievedAt}. It does not change the sandbox workspace or claim a current official alert. Requested point {delhiHistoricalReplay.requestedLocation}; returned grid point {delhiHistoricalReplay.gridPoint}.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-[1.0625rem] font-semibold">Why routing looks for water and shade</h3>
                    <p className="mt-1 text-[0.9375rem] text-label-2">June 2024 survey of gig workers in Hyderabad</p>

                    <div className="mt-5 grid grid-cols-2 gap-6">
                      <Fact value="65%" label="asked for clean water and toilets" />
                      <Fact value="55%" label="asked for shaded rest areas" />
                    </div>

                    <p className="mt-6 max-w-prose text-[0.9375rem] leading-relaxed text-label-2">
                      By HeatWatch and the Telangana Gig and Platform Workers Union. It supports the product direction. It is not a claim about Delhi, the simulated riders, or the facilities at this demo&apos;s rest points.
                    </p>
                    <p className="mt-3 max-w-prose text-[0.8125rem] leading-relaxed text-label-2">
                      Demo rest points are simulated; their names and routes do not verify real water, shade, toilet or cooling availability.{" "}
                      <a className="text-rest underline underline-offset-4" href="https://tgpwu.org/2024/08/17/impact-of-extreme-heat-on-gig-workers-a-survey-report/" target="_blank" rel="noreferrer">
                        Read the survey
                      </a>
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function RiderRow({
  worker,
  tone,
  Icon,
  label,
  selected,
  onSelect,
}: {
  worker: Worker;
  tone: StateTone;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex w-full items-center gap-3.5 rounded-2xl px-3.5 py-3 text-left transition-colors",
          selected ? "bg-fill" : "hover:bg-fill/60",
        )}
      >
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", TONE_CIRCLE[tone])}>
          <Icon aria-hidden="true" className="size-5" strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1.0625rem] font-medium">{worker.name}</span>
          <span className="block text-[0.875rem] text-label-2">{worker.activeMinutes} min active</span>
        </span>
        <span className="shrink-0 text-[0.875rem] text-label-2">{label}</span>
      </button>
    </li>
  );
}
