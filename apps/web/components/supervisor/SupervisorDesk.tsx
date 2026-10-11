"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleCheck, ExternalLink, Hourglass, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import type { DashboardResponse, Intervention } from "@taapsaathi/contracts";
import DeskHeader from "@/components/shell/DeskHeader";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ago, clock, elapsed } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { TONE_CIRCLE } from "@/components/status/stateMeta";
import { humanize } from "@/lib/humanize";

/**
 * The supervisor desk. One job: see who is waiting on you, longest first, and record that you
 * have seen it. It is used on a laptop first and on a phone second, so the queue and the case
 * sit side by side on a wide screen and the case opens as a sheet on a narrow one.
 */

export type AckRecord = { workerId: string; acceptedAt: string };

export type SupervisorDeskProps = {
  data: DashboardResponse | null;
  supervisorId: string | null;
  error: string | null;
  lastUpdated: Date | null;
  pendingId: string | null;
  /** Interventions this supervisor has just acknowledged and the live workflow has not caught up with. */
  acknowledgedIds: ReadonlySet<string>;
  recentAck: AckRecord | null;
  onAcknowledge: (interventionId: string) => void;
  onRefresh: () => void;
};

type Case = { intervention: Intervention; overdue: boolean };

const REASONS: Record<string, string> = {
  FEEL_UNWELL: "Rider said they feel unwell",
  WORKER_TIMEOUT: "Rider did not reply in time",
  NO_ELIGIBLE_WORKER: "No rider was free to take the delivery",
};

function reasonOf(intervention: Intervention): string {
  return intervention.escalationReason ? (REASONS[intervention.escalationReason] ?? humanize(intervention.escalationReason)) : "Needs supervisor review";
}

function isWaiting(intervention: Intervention): boolean {
  return ["AWAITING_SUPERVISOR", "SUPERVISOR_UNACKNOWLEDGED"].includes(intervention.status);
}

function WaitClock({ since, now, className }: { since: string; now: number | null; className?: string }) {
  return (
    <span className={cn("tabular-nums", className)} suppressHydrationWarning>
      {now === null ? "–:––" : elapsed(now - new Date(since).getTime())}
    </span>
  );
}

function Notice({ tone, icon, children }: { tone: "safe" | "critical"; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p
      role={tone === "critical" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-2xl px-4 py-3.5 text-[0.9375rem]",
        tone === "safe" ? "bg-safe-tint text-safe-ink" : "bg-critical-tint text-critical-ink",
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </p>
  );
}

function CaseRow({
  item,
  name,
  selected,
  acknowledged,
  now,
  onSelect,
}: {
  item: Case;
  name: string;
  selected: boolean;
  acknowledged: boolean;
  now: number | null;
  onSelect: () => void;
}) {
  const { intervention, overdue } = item;
  const tone = acknowledged ? "safe" : overdue ? "critical" : "wait";
  const Icon = acknowledged ? CircleCheck : overdue ? TriangleAlert : Hourglass;
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
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-full", TONE_CIRCLE[tone])}>
          <Icon aria-hidden="true" className="size-5" strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[1.0625rem] font-medium">{name}</span>
            <WaitClock since={intervention.createdAt} now={now} className="shrink-0 text-[0.9375rem] text-label-2" />
          </span>
          <span className="block truncate text-[0.9375rem] text-label-2">
            {acknowledged ? "Acknowledged" : overdue ? "Reply window passed" : reasonOf(intervention)}
          </span>
        </span>
      </button>
    </li>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[0.8125rem] text-label-2">{label}</dt>
      <dd className="mt-0.5 text-[1.0625rem] font-medium">{children}</dd>
    </div>
  );
}

function CaseDetail({
  item,
  data,
  supervisorId,
  acknowledged,
  pending,
  now,
  onAcknowledge,
}: {
  item: Case;
  data: DashboardResponse;
  supervisorId: string | null;
  acknowledged: boolean;
  pending: boolean;
  now: number | null;
  onAcknowledge: () => void;
}) {
  const { intervention, overdue } = item;
  const worker = data.workers.find((candidate) => candidate.workerId === intervention.workerId);
  const task = data.tasks.find((candidate) => candidate.taskId === intervention.taskId);
  const owner = task?.assigneeId ? data.workers.find((candidate) => candidate.workerId === task.assigneeId)?.name : null;
  const name = worker?.name ?? intervention.workerId;
  const route = intervention.route;

  return (
    <div>
      <p className="text-[0.9375rem] text-label-2">{reasonOf(intervention)}</p>
      <h2 className="mt-0.5 text-[1.375rem] font-semibold leading-tight tracking-tight">{name}</h2>

      <p className="mt-4 flex flex-wrap items-baseline gap-x-3">
        <WaitClock since={intervention.createdAt} now={now} className="text-[1.75rem] font-medium leading-none tracking-tight" />
        <span className="text-[0.9375rem] text-label-2">since {clock(new Date(intervention.createdAt))}</span>
      </p>

      {overdue && !acknowledged && (
        <div className="mt-5">
          <Notice tone="critical" icon={<TriangleAlert aria-hidden="true" className="size-5" />}>
            The reply window has passed. {name} was told to stay somewhere safe and ask someone nearby for help.
          </Notice>
        </div>
      )}

      <dl className="mt-8 grid gap-x-10 gap-y-5 sm:grid-cols-2">
        <Fact label="Risk level">{intervention.riskLevel === "CRITICAL" ? "Critical" : "High"}</Fact>
        <Fact label="Active before alert">{worker ? `${worker.activeMinutes} min` : "Not recorded"}</Fact>
        <Fact label="Delivery">
          {intervention.replacementWorkerId
            ? `Handed to ${data.workers.find((candidate) => candidate.workerId === intervention.replacementWorkerId)?.name ?? intervention.replacementWorkerId}`
            : owner
              ? `With ${owner}`
              : "No rider has it yet"}
        </Fact>
        <Fact label="Nearest shade">
          {route ? `${route.restPointName}, ${Math.round(route.distanceMeters)} m` : "Not available"}
        </Fact>
      </dl>

      <div className="mt-9">
        {acknowledged ? (
          <Notice tone="safe" icon={<CircleCheck aria-hidden="true" className="size-5" />}>
            <strong className="font-medium">Acknowledgment recorded.</strong> {name} can see that you have seen this, and can go back to work once they confirm they feel well enough.
          </Notice>
        ) : (
          <>
            <Button size="xl" className="w-full sm:w-auto sm:min-w-72" disabled={!supervisorId || pending} onClick={onAcknowledge}>
              {pending && <LoaderCircle aria-hidden="true" className="animate-spin" />}
              {pending ? "Recording…" : "Record acknowledgment"}
            </Button>
            <p className="mt-3 max-w-prose text-[0.9375rem] leading-relaxed text-label-2">
              {supervisorId ? (
                <>
                  This tells {name} you have seen the alert and is recorded under <span className="text-label">{supervisorId}</span>.
                  It does not clear them to work or call emergency services.
                </>
              ) : (
                "Sign in with a supervisor account to record an acknowledgment."
              )}
            </p>
          </>
        )}

        <Link
          href={`/worker/${intervention.workerId}`}
          className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] text-rest underline-offset-4 hover:underline"
        >
          See what {name} sees
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

export default function SupervisorDesk({
  data,
  supervisorId,
  error,
  lastUpdated,
  pendingId,
  acknowledgedIds,
  recentAck,
  onAcknowledge,
  onRefresh,
}: SupervisorDeskProps) {
  const now = useNow(1000);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const cases: Case[] = useMemo(() => {
    const waiting = (data?.activeInterventions ?? []).filter(isWaiting).map((intervention) => ({
      intervention,
      overdue: intervention.status === "SUPERVISOR_UNACKNOWLEDGED",
    }));
    // A passed reply window comes first, then a critical rider, then whoever has waited longest.
    return waiting.sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) ||
        Number(b.intervention.riskLevel === "CRITICAL") - Number(a.intervention.riskLevel === "CRITICAL") ||
        a.intervention.createdAt.localeCompare(b.intervention.createdAt),
    );
  }, [data]);

  const selected = cases.find((item) => item.intervention.interventionId === selectedId) ?? cases[0] ?? null;

  useEffect(() => {
    if (cases.length === 0) setSheetOpen(false);
  }, [cases.length]);

  const nameOf = (workerId: string) => data?.workers.find((worker) => worker.workerId === workerId)?.name ?? workerId;
  const staleSeconds = lastUpdated && now !== null ? now - lastUpdated.getTime() : null;

  function select(id: string) {
    setSelectedId(id);
    setSheetOpen(true);
  }

  const detail =
    selected && data ? (
      <CaseDetail
        item={selected}
        data={data}
        supervisorId={supervisorId}
        acknowledged={acknowledgedIds.has(selected.intervention.interventionId)}
        pending={pendingId === selected.intervention.interventionId}
        now={now}
        onAcknowledge={() => onAcknowledge(selected.intervention.interventionId)}
      />
    ) : null;

  return (
    <div className="min-h-dvh bg-canvas">
      <DeskHeader />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[1.625rem] font-semibold tracking-tight">Waiting on you</h1>
            <p className="mt-1 text-[0.9375rem] text-label-2" aria-live="polite">
              {!data
                ? "Loading the queue…"
                : cases.length === 0
                  ? "Nobody is waiting for an acknowledgment."
                  : `${cases.length} ${cases.length === 1 ? "rider is" : "riders are"} waiting, most urgent first.`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[0.875rem] text-label-2" suppressHydrationWarning>
              {staleSeconds === null ? "" : `Checked ${ago(staleSeconds)}`}
            </span>
            <Button variant="secondary" onClick={onRefresh}>
              <RefreshCw aria-hidden="true" />
              Check now
            </Button>
          </div>
        </div>

        {(error || recentAck) && (
          <div className="mt-5 space-y-3">
            {error && (
              <Notice tone="critical" icon={<TriangleAlert aria-hidden="true" className="size-5" />}>
                {error}
              </Notice>
            )}
            {recentAck && (
              <Notice tone="safe" icon={<CircleCheck aria-hidden="true" className="size-5" />}>
                You acknowledged {nameOf(recentAck.workerId)} at {clock(new Date(recentAck.acceptedAt))}.
              </Notice>
            )}
          </div>
        )}

        {data && cases.length === 0 ? (
          <div className="mt-8 max-w-md rounded-3xl bg-surface p-8">
            <span className={cn("grid size-12 place-items-center rounded-full", TONE_CIRCLE.safe)}>
              <CircleCheck aria-hidden="true" className="size-6" strokeWidth={2.2} />
            </span>
            <p className="mt-5 text-[1.25rem] font-semibold">You are all caught up</p>
            <p className="mt-1 text-[1rem] leading-relaxed text-label-2">
              New escalations show up here on their own. You do not need to refresh.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
            <ul aria-label="Riders waiting for acknowledgment" className="space-y-1 self-start rounded-3xl bg-surface p-2">
              {!data && <li className="m-1.5 h-16 animate-pulse rounded-2xl bg-fill" aria-hidden="true" />}
              {cases.map((item) => (
                <CaseRow
                  key={item.intervention.interventionId}
                  item={item}
                  name={nameOf(item.intervention.workerId)}
                  selected={selected?.intervention.interventionId === item.intervention.interventionId}
                  acknowledged={acknowledgedIds.has(item.intervention.interventionId)}
                  now={now}
                  onSelect={() => select(item.intervention.interventionId)}
                />
              ))}
            </ul>

            <section aria-label="Selected case" className="hidden min-w-0 rounded-3xl bg-surface p-8 lg:block">
              {detail}
            </section>
          </div>
        )}

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-3xl px-5 pb-8 lg:hidden">
            <SheetHeader className="px-0">
              <SheetTitle className="sr-only">Case details</SheetTitle>
              <SheetDescription className="sr-only">Details and acknowledgment for the selected rider.</SheetDescription>
            </SheetHeader>
            {detail}
          </SheetContent>
        </Sheet>
      </main>
    </div>
  );
}
