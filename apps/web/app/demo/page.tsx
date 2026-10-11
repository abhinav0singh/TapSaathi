"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import DeskHeader from "@/components/shell/DeskHeader";
import StateChip from "@/components/status/StateChip";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { recordedRuns, type Actor, type WorkerState } from "@/lib/recordedRuns";
import { humanize } from "@/lib/humanize";
import { cn } from "@/lib/utils";

/** HEAT_THRESHOLD_WITH_ACTIVE_EXPOSURE -> "heat threshold with active exposure". */
const readable = (text: string) => text.replace(/\b[A-Z]+(?:_[A-Z]+)+\b/g, (token) => token.toLowerCase().replaceAll("_", " "));

const actorLabel: Record<Actor, string> = {
  SYSTEM: "AWS workflow",
  WORKER: "Rider (Ravi)",
  SUPERVISOR: "Supervisor (Neha)",
};

export default function RecordedRunPage() {
  const [runId, setRunId] = useState(recordedRuns[0]!.id);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const run = recordedRuns.find((item) => item.id === runId) ?? recordedRuns[0]!;
  const last = run.steps.length - 1;
  const step = run.steps[Math.min(index, last)]!;

  useEffect(() => {
    if (!playing) return;
    if (index >= last) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setIndex((value) => Math.min(value + 1, last)), 2600);
    return () => window.clearTimeout(timer);
  }, [playing, index, last]);

  function choose(id: (typeof recordedRuns)[number]["id"]) {
    setRunId(id);
    setIndex(0);
    setPlaying(false);
  }

  function play() {
    if (index >= last) setIndex(0);
    setPlaying((value) => !value);
  }

  const workers: Array<[string, WorkerState]> = [
    ["Ravi", step.workers.ravi],
    ["Asha", step.workers.asha],
    ["Imran", step.workers.imran],
  ];

  return (
    <div className="min-h-dvh bg-canvas">
      <DeskHeader />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <h1 className="text-[1.625rem] font-semibold tracking-tight">Recorded run</h1>
        <p className="mt-1 max-w-2xl text-[0.9375rem] leading-relaxed text-label-2">
          Step through a real run of the deployed AWS workflow. No sign-in needed.
        </p>

        <p role="note" className="mt-5 max-w-3xl rounded-2xl bg-caution-tint px-4 py-3.5 text-[0.9375rem] leading-relaxed text-caution-ink">
          <strong className="font-medium">This is a replay, not a live system.</strong> Every step is an audit event written by the AWS workflow on{" "}
          {run.recordedOn} (demo generation {run.generation}). The weather, riders and rest points are simulated demonstration data.
        </p>

        <div className="mt-6">
          <Tabs value={run.id} onValueChange={(value) => choose(value as (typeof recordedRuns)[number]["id"])}>
            <TabsList aria-label="Recorded runs" className="h-auto flex-wrap">
              {recordedRuns.map((item) => (
                <TabsTrigger key={item.id} value={item.id} className="h-9 px-4">
                  {item.title}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <p className="mt-3 max-w-3xl text-[1rem] leading-relaxed text-label-2">{run.summary}</p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          <ol aria-label="Recorded steps" className="min-w-0 space-y-1 self-start rounded-3xl bg-surface p-2">
            {run.steps.map((item, position) => (
              <li key={`${item.at}-${item.event}`}>
                <button
                  type="button"
                  onClick={() => {
                    setIndex(position);
                    setPlaying(false);
                  }}
                  aria-current={position === index ? "step" : undefined}
                  className={cn(
                    "flex w-full items-baseline gap-3 rounded-2xl px-3.5 py-3 text-left transition-colors",
                    position === index ? "bg-fill" : "hover:bg-fill/60",
                    position > index && "text-label-2",
                  )}
                >
                  <span className="w-16 shrink-0 text-[0.875rem] tabular-nums text-label-2">{item.at}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[1rem] font-medium leading-snug">{humanize(item.event)}</span>
                    <span className="block text-[0.8125rem] text-label-2">{actorLabel[item.actor]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <div className="order-first min-w-0 space-y-6 lg:order-none">
            <section aria-live="polite" className="rounded-3xl bg-surface p-7 sm:p-8">
              <p className="text-[0.875rem] text-label-2">
                Step {index + 1} of {run.steps.length}, {step.service}
              </p>
              <h2 className="mt-1 text-[1.25rem] font-semibold tracking-tight">{humanize(step.event)}</h2>
              <p className="mt-3 max-w-2xl text-[1rem] leading-relaxed [overflow-wrap:anywhere]">{readable(step.plain)}</p>
            </section>

            <div className="grid gap-6 sm:grid-cols-2">
              <section aria-label="What the rider sees" className="rounded-3xl bg-surface p-6">
                <h3 className="text-[0.9375rem] font-medium text-label-2">What Ravi sees</h3>
                <p className="mt-3 rounded-2xl bg-fill p-4 text-[1.0625rem] leading-relaxed">{step.rider}</p>
              </section>

              <section aria-label="Operations board" className="rounded-3xl bg-surface p-6">
                <h3 className="text-[0.9375rem] font-medium text-label-2">Operations board</h3>
                <ul className="mt-3 space-y-1">
                  {workers.map(([name, state]) => (
                    <li key={name} className="flex items-center justify-between rounded-xl px-1 py-2">
                      <span className="text-[1.0625rem] font-medium">{name}</span>
                      <StateChip state={state} />
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[0.9375rem] text-label-2">
                  delivery-001 is with <span className="font-medium text-label">{step.deliveryOwner}</span>
                </p>
              </section>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                size="lg"
                disabled={index === 0}
                onClick={() => {
                  setIndex((value) => Math.max(0, value - 1));
                  setPlaying(false);
                }}
              >
                <ChevronLeft aria-hidden="true" />
                Back
              </Button>
              <Button size="lg" onClick={play}>
                {playing ? <Pause aria-hidden="true" /> : index >= last ? <RotateCcw aria-hidden="true" /> : <Play aria-hidden="true" />}
                {playing ? "Pause" : index >= last ? "Replay" : "Play"}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                disabled={index >= last}
                onClick={() => {
                  setIndex((value) => Math.min(last, value + 1));
                  setPlaying(false);
                }}
              >
                Next
                <ChevronRight aria-hidden="true" />
              </Button>
              <Link href="/ops" className="ml-auto text-[0.9375rem] text-rest underline-offset-4 hover:underline">
                Open the live board (read-only)
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-10 text-center text-[0.8125rem] text-label-2">
          TaapSaathi makes no medical claims and does not contact emergency services. Recorded events are summarised from the audit trail in docs/GOLDEN_PATH_EVIDENCE.md.
        </p>
      </main>
    </div>
  );
}
