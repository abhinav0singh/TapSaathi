"use client";

import { Check, TriangleAlert } from "lucide-react";
import type { Intervention } from "@taapsaathi/contracts";
import { cn } from "@/lib/utils";
import { elapsed } from "@/lib/time";
import { stageView, type Stage } from "@/lib/stages";

/**
 * The run as a short vertical list: done, now, not yet. The stages are real steps of the workflow,
 * so order is information; the one that needs attention is the only one that moves.
 */

const IDLE: Stage[] = ["Heat risk detected", "Rider guided", "Rider replies", "Delivery covered", "Resolved"].map(
  (label) => ({ id: label, label, state: "todo" as const }),
);

type FollowUp = {
  riderName: string;
  status: "ACKNOWLEDGED" | "UNACKNOWLEDGED";
};

function followUpStages(status: FollowUp["status"]): Stage[] {
  return status === "UNACKNOWLEDGED"
    ? [
        { id: "alert-ended", label: "Heat alert ended", state: "done" },
        { id: "delivery-secured", label: "Delivery secured", state: "done" },
        { id: "supervisor-follow-up", label: "Supervisor follow-up", state: "alert" },
      ]
    : [
        { id: "alert-ended", label: "Heat alert ended", state: "done" },
        { id: "supervisor-acknowledged", label: "Supervisor acknowledged", state: "done" },
        { id: "rider-resume", label: "Rider confirms readiness", state: "current" },
      ];
}

function Marker({ state }: { state: Stage["state"] }) {
  const base = "relative z-10 grid size-7 shrink-0 place-items-center rounded-full";
  if (state === "done") {
    return (
      <span className={cn(base, "bg-primary text-primary-foreground")}>
        <Check aria-hidden="true" className="size-4" strokeWidth={3} />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className={cn(base, "breathe bg-high")}>
        <span className="size-2.5 rounded-full bg-white" />
      </span>
    );
  }
  if (state === "alert") {
    return (
      <span className={cn(base, "bg-critical text-white")}>
        <TriangleAlert aria-hidden="true" className="size-4" strokeWidth={2.4} />
      </span>
    );
  }
  return <span className={cn(base, "bg-fill-strong")} />;
}

const STATE_WORD: Record<Stage["state"], string> = {
  done: "Done",
  current: "Happening now",
  alert: "Needs attention",
  todo: "Not yet",
};

type Props = {
  intervention: Intervention | null;
  riderName: string;
  followUp: FollowUp | null;
  more: number;
  now: number | null;
};

export default function StageList({ intervention, riderName, followUp, more, now }: Props) {
  const view = intervention ? stageView(intervention, riderName) : null;
  const stages = view?.stages ?? (followUp ? followUpStages(followUp.status) : IDLE);
  const headline = intervention
    ? `${riderName}: heat alert`
    : followUp?.status === "UNACKNOWLEDGED"
      ? `${followUp.riderName} needs supervisor follow-up`
      : followUp
        ? `${followUp.riderName} may confirm readiness`
        : "No heat alert right now";
  const summary = view
    ? view.summary
    : followUp?.status === "UNACKNOWLEDGED"
      ? "No heat alert is running. An earlier alert ended without a supervisor acknowledgement, so this rider cannot resume through Sahara."
      : followUp
        ? "No heat alert is running. The earlier alert is acknowledged; the rider can self-declare readiness from their own signed-in phone."
        : "No active heat alert. The workspace will show rider safety follow-up when the policy opens an intervention.";

  return (
    <section aria-label="Current alert or outstanding follow-up" className="rounded-3xl bg-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[1.125rem] font-semibold leading-snug tracking-tight">
            {headline}
          </h2>
          <p className="mt-1 text-[0.9375rem] leading-relaxed text-label-2" aria-live="polite">
            {summary}
          </p>
          {more > 0 && (
            <p className="mt-1 text-[0.875rem] text-label-2">
              {more} more {more === 1 ? "alert is" : "alerts are"} also running.
            </p>
          )}
        </div>
        {intervention && (
          <p className="shrink-0 text-[1.0625rem] font-medium tabular-nums" suppressHydrationWarning>
            {now === null ? "–:––" : elapsed(now - new Date(intervention.createdAt).getTime())}
          </p>
        )}
      </div>

      <ol className="mt-6">
        {stages.map((stage, index) => (
          <li key={stage.id} className="relative flex items-center gap-3.5 pb-5 last:pb-0">
            {index < stages.length - 1 && (
              <span
                aria-hidden="true"
                className={cn("absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5", stage.state === "done" ? "bg-primary" : "bg-fill-strong")}
              />
            )}
            <Marker state={stage.state} />
            <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
              <span
                className={cn(
                  "text-[1rem]",
                  stage.state === "todo" ? "text-label-2" : "font-medium",
                  stage.state === "alert" && "text-critical-ink",
                )}
              >
                {stage.label}
              </span>
              <span className={cn("shrink-0 text-[0.8125rem]", stage.state === "alert" ? "text-critical-ink" : "text-label-2")}>
                {STATE_WORD[stage.state]}
              </span>
            </span>
          </li>
        ))}
      </ol>

    </section>
  );
}
