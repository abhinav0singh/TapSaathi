"use client";

import { useState } from "react";
import { Activity, ArrowRight, Check, Coffee, Flame, HeartPulse, MapPin, Route, RotateCcw, ShieldCheck, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { nextWalkthroughStep, walkthroughState, type WalkthroughStep, type WalkthroughWorkerState } from "@/lib/landingScenario";

const stateStyle: Record<WalkthroughWorkerState, string> = {
  SAFE: "bg-safe-tint text-safe-ink",
  CAUTION: "bg-caution-tint text-caution-ink",
  HIGH: "bg-high-tint text-high-ink",
  RESTING: "bg-rest-tint text-rest-ink",
  AWAITING_SUPERVISOR: "bg-critical-tint text-critical-ink",
};

const stateLabel: Record<WalkthroughWorkerState, string> = {
  SAFE: "Safe",
  CAUTION: "Caution",
  HIGH: "High heat risk",
  RESTING: "Resting",
  AWAITING_SUPERVISOR: "Supervisor follow-up",
};

const markerStyle: Record<WalkthroughWorkerState, string> = {
  SAFE: "bg-safe",
  CAUTION: "bg-caution",
  HIGH: "bg-high",
  RESTING: "bg-rest",
  AWAITING_SUPERVISOR: "bg-critical",
};

const actionPrompt: Record<WalkthroughStep, string> = {
  ready: "Start with the simulated heat-risk signal.",
  heat: "Ravi chooses how to respond to the heat-risk guidance.",
  break: "The simulated break outcome is complete.",
  unwell: "A supervisor needs to review Ravi’s follow-up.",
  acknowledged: "Ravi can self-declare readiness when appropriate.",
  resumed: "The simulated follow-up is complete.",
};

function StatePill({ state }: { state: WalkthroughWorkerState }) {
  return <span className={cn("rounded-full px-2.5 py-1 text-[0.75rem] font-semibold", stateStyle[state])}>{stateLabel[state]}</span>;
}

function ScenarioButton({
  visible,
  onClick,
  icon,
  children,
  variant = "secondary",
}: {
  visible: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  variant?: "default" | "secondary" | "danger";
}) {
  if (!visible) return null;
  return (
    <Button
      variant={variant}
      size="lg"
      onClick={onClick}
      className={cn(
        "w-full justify-start sm:w-auto",
        variant === "danger" ? "bg-critical text-white hover:bg-critical/85" : "bg-white text-ink hover:bg-white/90",
      )}
    >
      {icon}
      {children}
    </Button>
  );
}

/** A local, deterministic walkthrough. It intentionally imports no API or auth code. */
export default function InteractiveWalkthrough() {
  const [step, setStep] = useState<WalkthroughStep>("ready");
  const scenario = walkthroughState(step);
  const action = (name: Parameters<typeof nextWalkthroughStep>[1]) => setStep((current) => nextWalkthroughStep(current, name));
  const isHeatActive = step === "heat";
  const isEscalated = step === "unwell" || step === "acknowledged";

  return (
    <section id="walkthrough" aria-labelledby="walkthrough-title" className="scroll-mt-6 rounded-[2rem] bg-[#163d39] p-4 text-white shadow-[0_24px_80px_rgba(20,55,50,0.18)] sm:p-7 lg:p-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[0.8125rem] font-medium text-[#f8d99e]">Interactive simulated walkthrough</p>
          <h2 id="walkthrough-title" className="mt-4 text-[clamp(1.6rem,3vw,2.35rem)] font-semibold leading-tight tracking-tight">See a heat-risk response move together.</h2>
          <p className="mt-3 text-[1rem] leading-relaxed text-white/75">Every button changes this local illustration only. It never reads or changes live operations, rider data, or AWS workflows.</p>
        </div>
        {step !== "ready" && (
          <button type="button" onClick={() => action("RESTART")} className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-[0.875rem] font-medium text-white/75 hover:bg-white/10 hover:text-white">
            <RotateCcw aria-hidden="true" className="size-4" /> Restart
          </button>
        )}
      </div>

      <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)]">
        <section aria-label="Simulated operations map" className="relative min-h-[26rem] overflow-hidden rounded-3xl bg-[#e8eee9] p-5 text-ink sm:min-h-[30rem]">
          <div aria-hidden="true" className="absolute inset-0 opacity-70 [background-image:linear-gradient(30deg,transparent_48%,#cfddd5_49%,#cfddd5_51%,transparent_52%),linear-gradient(-38deg,transparent_48%,#d6e1da_49%,#d6e1da_51%,transparent_52%)] [background-size:100px_82px]" />
          <div className="relative flex items-center justify-between gap-3">
            <div>
              <p className="text-[0.8125rem] font-medium text-label-2">SIMULATED OPERATIONS MAP</p>
              <p className="mt-1 text-[1.125rem] font-semibold">Delhi North</p>
            </div>
            <span className="rounded-full bg-surface px-3 py-1.5 text-[0.8125rem] text-label-2">No live location data</span>
          </div>

          {isHeatActive && <div aria-hidden="true" className="absolute left-[23%] top-[27%] size-52 rounded-full bg-high/20 blur-2xl" />}
          {(step === "break" || isEscalated) && <div aria-hidden="true" className="absolute left-[26%] top-[31%] h-1 w-[45%] origin-left rotate-[18deg] bg-rest/80" />}

          <div className={cn("absolute left-[14%] top-[28%] grid size-14 place-items-center rounded-full border-4 border-white text-lg font-bold text-white shadow-lg", markerStyle[scenario.ravi], isHeatActive && "breathe")}>R</div>
          <div className="absolute left-[50%] top-[46%] grid size-14 place-items-center rounded-full border-4 border-white bg-safe text-lg font-bold text-white shadow-lg">A</div>
          <div className="absolute right-[16%] top-[19%] grid size-11 place-items-center rounded-2xl border-4 border-white bg-ink text-white shadow-lg"><MapPin aria-hidden="true" className="size-5" /></div>

          <div className="absolute bottom-5 left-5 right-5 grid gap-3 rounded-2xl bg-surface/95 p-4 shadow-sm sm:grid-cols-3">
            <div><p className="text-[0.75rem] text-label-2">Ravi</p><div className="mt-1"><StatePill state={scenario.ravi} /></div></div>
            <div><p className="text-[0.75rem] text-label-2">Asha</p><div className="mt-1"><StatePill state={scenario.asha} /></div></div>
            <div><p className="text-[0.75rem] text-label-2">delivery-001</p><p className="mt-1 text-[0.875rem] font-semibold">With {scenario.deliveryOwner}</p></div>
          </div>
        </section>

        <section aria-label="Ravi simulated phone" className="rounded-3xl bg-[#f5f5f7] p-3 text-ink sm:p-5">
          <div className="mx-auto flex min-h-[26rem] max-w-[23rem] flex-col overflow-hidden rounded-[2rem] border-[7px] border-ink bg-surface shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 text-[0.8125rem] text-label-2"><span>9:41</span><span>Ravi’s safety screen</span></div>
            <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
              <div className={cn("grid size-12 place-items-center rounded-2xl", stateStyle[scenario.ravi])}>
                {scenario.ravi === "HIGH" ? <Flame aria-hidden="true" className="size-6" /> : scenario.ravi === "RESTING" ? <Coffee aria-hidden="true" className="size-6" /> : scenario.ravi === "AWAITING_SUPERVISOR" ? <HeartPulse aria-hidden="true" className="size-6" /> : <ShieldCheck aria-hidden="true" className="size-6" />}
              </div>
              <h3 className="mt-5 text-[1.4rem] font-semibold leading-tight">{stateLabel[scenario.ravi]}</h3>
              <p className="mt-3 text-[1rem] leading-relaxed text-label-2">{scenario.riderMessage}</p>
              {isHeatActive && <div className="mt-5 rounded-2xl bg-fill p-4"><p className="text-[0.8125rem] text-label-2">Nearest simulated shade</p><p className="mt-1 flex items-center gap-2 font-semibold"><Route aria-hidden="true" className="size-4" /> Community shade point · 7 min</p></div>}
              {isEscalated && <div className="mt-5 rounded-2xl bg-fill p-4"><p className="text-[0.8125rem] text-label-2">Supervisor</p><p className="mt-1 font-semibold">{scenario.supervisorMessage}</p></div>}
              <p className="mt-auto pt-6 text-[0.75rem] leading-relaxed text-label-2">Illustrated scenario only. Sahara does not diagnose, clear a rider for work, or contact emergency services.</p>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.75fr)]">
        <section aria-label="Walkthrough controls" className="rounded-3xl bg-white/10 p-5">
          <p className="text-[0.8125rem] font-medium tracking-wide text-[#f8d99e]">TRY THE DECISIONS</p>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-white/80">{actionPrompt[step]}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <ScenarioButton visible={step === "ready"} onClick={() => action("TRIGGER_HEAT")} icon={<Flame aria-hidden="true" />} variant="danger">Trigger heat risk</ScenarioButton>
            <ScenarioButton visible={step === "heat"} onClick={() => action("TAKE_BREAK")} icon={<Coffee aria-hidden="true" />}>Ravi takes a break</ScenarioButton>
            <ScenarioButton visible={step === "heat"} onClick={() => action("FEEL_UNWELL")} icon={<HeartPulse aria-hidden="true" />} variant="danger">Ravi feels unwell</ScenarioButton>
            <ScenarioButton visible={step === "unwell"} onClick={() => action("ACKNOWLEDGE")} icon={<UserRoundCheck aria-hidden="true" />}>Supervisor acknowledges</ScenarioButton>
            <ScenarioButton visible={step === "acknowledged"} onClick={() => action("RESUME")} icon={<Check aria-hidden="true" />}>Ravi confirms readiness</ScenarioButton>
            {(step === "break" || step === "resumed") && <p className="self-center text-[0.9375rem] text-white/80">This simulated outcome is complete. Restart to explore another path.</p>}
          </div>
          <p aria-live="polite" className="sr-only">Walkthrough status. Ravi: {stateLabel[scenario.ravi]}. delivery-001: with {scenario.deliveryOwner}.</p>
        </section>
        <section aria-label="Simulated audit trail" className="rounded-3xl bg-white/10 p-5">
          <p className="text-[0.8125rem] font-medium tracking-wide text-[#f8d99e]">SIMULATED AUDIT TRAIL</p>
          <ol className="mt-3 space-y-2.5">
            {scenario.audit.map((item) => <li key={item} className="flex gap-3 text-[0.9375rem] text-white/90"><Activity aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#f8d99e]" />{item}</li>)}
          </ol>
        </section>
      </div>
    </section>
  );
}
