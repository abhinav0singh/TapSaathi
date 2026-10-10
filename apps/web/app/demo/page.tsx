"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import { recordedRuns, type Actor, type WorkerState } from "@/lib/recordedRuns";

const stateStyles: Record<WorkerState, string> = {
  SAFE: "bg-emerald-50 text-emerald-800",
  CAUTION: "bg-amber-50 text-amber-800",
  HIGH: "bg-orange-50 text-orange-800",
  RESTING: "bg-blue-50 text-blue-800",
  AWAITING_SUPERVISOR: "bg-violet-50 text-violet-800",
};

const actorLabel: Record<Actor, string> = {
  SYSTEM: "AWS workflow",
  WORKER: "Rider (Ravi)",
  SUPERVISOR: "Supervisor (Neha)",
};

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600";

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

  function choose(id: typeof runId) {
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
    <main className="min-h-screen overflow-x-hidden bg-[#f5f7fb] px-4 py-6 text-slate-900 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4 rounded-3xl bg-[#07110f] p-6 text-white md:p-8">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-orange-300">TAAPSAATHI</p>
            <h1 className="mt-3 text-3xl font-black tracking-[-.035em] md:text-5xl">Recorded run</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
              Step through a real run of the deployed AWS workflow. No sign-in needed.
            </p>
          </div>
          <AppNav />
        </header>

        <div role="note" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>This is a replay, not a live system.</strong> Every step is an audit event written by the AWS workflow on{" "}
          {run.recordedOn} (demo generation {run.generation}). The weather, riders and rest points are simulated demonstration data.
        </div>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Recorded runs">
          {recordedRuns.map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={item.id === run.id}
              onClick={() => choose(item.id)}
              className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${focus} ${
                item.id === run.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {item.title}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-600">{run.summary}</p>

        <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
          <ol className="min-w-0 space-y-2" aria-label="Recorded steps">
            {run.steps.map((item, position) => (
              <li key={`${item.at}-${item.event}`}>
                <button
                  onClick={() => { setIndex(position); setPlaying(false); }}
                  aria-current={position === index ? "step" : undefined}
                  className={`w-full rounded-2xl border p-4 text-left transition ${focus} ${
                    position === index ? "border-orange-400 bg-white shadow-md" : position < index ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 text-slate-500"
                  }`}
                >
                  <span className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-mono">{item.at} UTC</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{actorLabel[item.actor]}</span>
                  </span>
                  <span className="mt-2 block font-mono text-sm font-bold">{item.event}</span>
                </button>
              </li>
            ))}
          </ol>

          <div className="order-first min-w-0 space-y-5 lg:order-none">
            <section aria-live="polite" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[.18em] text-orange-700">
                Step {index + 1} of {run.steps.length} · {step.service}
              </p>
              <h2 className="mt-3 font-mono text-lg font-bold">{step.event}</h2>
              <p className="mt-3 leading-7 text-slate-700 [overflow-wrap:anywhere]">{step.plain}</p>
            </section>

            <div className="grid gap-5 sm:grid-cols-2">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="What the rider sees">
                <p className="text-xs font-bold uppercase tracking-[.18em] text-slate-500">Rider screen</p>
                <div className="mt-3 rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500">Ravi</p>
                  <p className="mt-2 text-base font-semibold leading-6">{step.rider}</p>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Operations board">
                <p className="text-xs font-bold uppercase tracking-[.18em] text-slate-500">Operations board</p>
                <ul className="mt-3 space-y-2">
                  {workers.map(([name, state]) => (
                    <li key={name} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-sm">
                      <span className="font-semibold">{name}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${stateStyles[state]}`}>{state.replaceAll("_", " ")}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-slate-600">
                  delivery-001 is with <strong>{step.deliveryOwner}</strong>
                </p>
              </section>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => { setIndex((v) => Math.max(0, v - 1)); setPlaying(false); }} disabled={index === 0}
                className={`min-h-12 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold disabled:opacity-40 ${focus}`}>Back</button>
              <button onClick={play} className={`min-h-12 rounded-xl bg-slate-900 px-6 text-sm font-bold text-white ${focus}`}>
                {playing ? "Pause" : index >= last ? "Replay" : "Play"}
              </button>
              <button onClick={() => { setIndex((v) => Math.min(last, v + 1)); setPlaying(false); }} disabled={index >= last}
                className={`min-h-12 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold disabled:opacity-40 ${focus}`}>Next</button>
              <Link href="/ops" className={`ml-auto text-sm font-semibold text-orange-700 underline ${focus}`}>Open the live board (read-only)</Link>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500">
          TaapSaathi makes no medical claims and does not contact emergency services. Recorded events are summarised from the audit trail in docs/GOLDEN_PATH_EVIDENCE.md.
        </p>
      </div>
    </main>
  );
}
