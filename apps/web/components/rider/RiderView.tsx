"use client";

import type { ComponentType, ReactNode, RefObject } from "react";
import Link from "next/link";
import {
  CircleCheck,
  HeartPulse,
  Hourglass,
  LoaderCircle,
  MapPin,
  OctagonAlert,
  Pause,
  Phone,
  Volume2,
  WifiOff,
  type LucideProps,
} from "lucide-react";
import type { Language, InterventionStatus, RiskState, RouteView } from "@taapsaathi/contracts";
import RoutePreview from "@/components/worker/RoutePreview";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STATE_META, TONE_CIRCLE, TONE_PILL, type StateTone } from "@/components/status/stateMeta";
import { cn } from "@/lib/utils";
import { clock } from "@/lib/time";
import { useNow } from "@/lib/useNow";

/**
 * The rider screen, as a pure view, in the pattern riders already know from ride apps: the route
 * on top, a sheet below, one clear action at the bottom. It is built for one person outdoors at
 * 40°C or more, one hand on the phone, so text stays large, contrast stays high and the actions
 * sit inside thumb reach. Hindi and English are always one line apart.
 */

export type RiderMode =
  | "act"
  | "readonly"
  | "resume"
  | "resume-symptom"
  | "resting-readonly"
  | "info";

export type SupervisorOutcomeKind = "ACKNOWLEDGED" | "UNACKNOWLEDGED" | null;

export type RiderViewProps = {
  language: Language;
  workerName: string | null;
  activeMinutes: number | null;
  state: RiskState | null;
  outcome: SupervisorOutcomeKind;
  instruction: string;
  workflowStatus: InterventionStatus | null;
  route: RouteView | null;
  audioUrl: string | null;
  audioError: string | null;
  audioRef: RefObject<HTMLAudioElement | null>;
  stale: boolean;
  error: string | null;
  lastUpdatedAt: Date | null;
  mode: RiderMode;
  pending: boolean;
  accepted: boolean;
  fitConfirmed: boolean;
  signedOut: boolean;
  sessionLink: ReactNode;
  onLanguage: (language: Language) => void;
  onRespond: (action: "TAKE_BREAK" | "FEEL_UNWELL") => void;
  onResume: () => void;
  onFitChange: (value: boolean) => void;
  onReplay: () => void;
  onRetry: () => void;
};

type Pair = Record<Language, string>;

const copy = {
  loading: { en: "Getting your safety update…", hi: "सुरक्षा जानकारी आ रही है…" },
  activeFor: { en: "Active {n} min", hi: "{n} मिनट से काम पर" },
  updatedSeconds: { en: "Updated {n} s ago", hi: "{n} सेकंड पहले अपडेट हुआ" },
  updatedMinutes: { en: "Updated {n} min ago", hi: "{n} मिनट पहले अपडेट हुआ" },
  noSignal: {
    en: "No signal. Showing what we knew at {time}.",
    hi: "सिग्नल नहीं है। {time} तक की जानकारी दिख रही है।",
  },
  shade: { en: "Nearest shade", hi: "नज़दीकी छाँव" },
  walk: { en: "{m} m, about {t} min on foot", hi: "{m} मीटर, पैदल लगभग {t} मिनट" },
  walkShort: { en: "{m} m", hi: "{m} मीटर" },
  hear: { en: "Hear this", hi: "सुनें" },
  hearHelp: { en: "Play the spoken guidance", hi: "बोलकर सुझाव सुनें" },
  takeBreak: { en: "Take a break", hi: "ब्रेक लें" },
  feelUnwell: { en: "I feel unwell", hi: "तबीयत खराब है" },
  sending: { en: "Sending…", hi: "भेज रहे हैं…" },
  call: { en: "Call 112", hi: "112 कॉल करें" },
  noCall: {
    en: "TaapSaathi has not placed an emergency call.",
    hi: "TaapSaathi ने आपातकालीन कॉल नहीं की है।",
  },
  retry: { en: "Try again", hi: "फिर कोशिश करें" },
  signIn: { en: "Sign in as this rider", hi: "इस राइडर के रूप में साइन इन करें" },
  readonly: {
    en: "You are viewing {name}'s screen. Only {name}, signed in on their own phone, can reply.",
    hi: "आप {name} की स्क्रीन देख रहे हैं। जवाब केवल {name} अपने फ़ोन से साइन इन करके दे सकते हैं।",
  },
  restingReadonly: {
    en: "{name} can go back to work from their own signed-in phone after resting.",
    hi: "आराम के बाद {name} अपने साइन-इन फ़ोन से काम पर लौट सकते हैं।",
  },
  resumeTitle: { en: "Ready to go back?", hi: "काम पर लौटने के लिए तैयार हैं?" },
  resumeHelp: {
    en: "Rest, drink water, then confirm. Your last delivery stays with another rider.",
    hi: "आराम करें, पानी पिएँ, फिर पुष्टि करें। आपकी पिछली डिलीवरी दूसरे राइडर के पास रहेगी।",
  },
  resumeSymptomHelp: {
    en: "You said you felt unwell and your supervisor has seen it. Go back only if you feel well enough. If not, keep resting and ask for help.",
    hi: "आपने तबीयत खराब बताई थी और सुपरवाइज़र ने देख लिया है। ठीक महसूस होने पर ही लौटें। नहीं तो आराम करें और मदद लें।",
  },
  fit: {
    en: "I feel well enough to go back to work.",
    hi: "मैं काम पर लौटने के लिए ठीक महसूस कर रहा/रही हूँ।",
  },
  resume: { en: "Go back to work", hi: "काम पर लौटें" },
  resuming: { en: "Updating…", hi: "अपडेट हो रहा है…" },
  accepted: {
    en: "Your reply was received. Waiting for the system to confirm.",
    hi: "आपका जवाब मिल गया। सिस्टम की पुष्टि का इंतज़ार है।",
  },
  ackHeadline: { en: "Your supervisor has seen this", hi: "सुपरवाइज़र ने देख लिया है" },
  ackInstruction: {
    en: "Rest in a safe place. Go back to work only when you feel well enough.",
    hi: "सुरक्षित जगह पर आराम करें। ठीक महसूस होने पर ही काम पर लौटें।",
  },
  overdueHeadline: { en: "No reply from your supervisor yet", hi: "सुपरवाइज़र का जवाब अभी नहीं आया" },
  overdueInstruction: {
    en: "Stay somewhere safe and ask someone nearby for help.",
    hi: "सुरक्षित जगह पर रहें और पास के किसी व्यक्ति से मदद माँगें।",
  },
  demo: {
    en: "Simulated demonstration. No real rider is at risk.",
    hi: "यह केवल डेमो है। कोई असली राइडर ख़तरे में नहीं है।",
  },
} satisfies Record<string, Pair>;

const workflowLine: Partial<Record<InterventionStatus, Pair>> = {
  CREATED: { en: "Alert started", hi: "अलर्ट शुरू हुआ" },
  GUIDANCE_READY: { en: "Guidance is ready", hi: "सुझाव तैयार है" },
  AWAITING_WORKER: { en: "Waiting for your reply", hi: "आपके जवाब का इंतज़ार" },
  REASSIGNING: { en: "Your delivery is moving to another rider", hi: "आपकी डिलीवरी दूसरे राइडर को दी जा रही है" },
  RESTING: { en: "Your delivery is covered. Rest now.", hi: "आपकी डिलीवरी संभल गई है। अब आराम करें।" },
  AWAITING_SUPERVISOR: { en: "Your supervisor has been alerted", hi: "सुपरवाइज़र को बता दिया गया है" },
  SUPERVISOR_RESPONDING: { en: "Your supervisor is responding", hi: "सुपरवाइज़र जवाब दे रहे हैं" },
  SUPERVISOR_UNACKNOWLEDGED: { en: "Your supervisor has not replied yet", hi: "सुपरवाइज़र ने अभी जवाब नहीं दिया" },
  REASSIGNMENT_REQUIRED: { en: "Finding someone to take your delivery", hi: "आपकी डिलीवरी के लिए किसी को ढूँढ रहे हैं" },
};

function fill(text: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    text,
  );
}

function other(language: Language): Language {
  return language === "en" ? "hi" : "en";
}

type Band = { tone: StateTone; Icon: ComponentType<LucideProps>; headline: Pair; instruction: string };

function bandFor(props: RiderViewProps): Band | null {
  const { state, outcome, instruction } = props;
  if (!state) return null;
  if (outcome === "ACKNOWLEDGED") {
    return { tone: "rest", Icon: CircleCheck, headline: copy.ackHeadline, instruction: copy.ackInstruction[props.language] };
  }
  if (outcome === "UNACKNOWLEDGED") {
    return { tone: "critical", Icon: OctagonAlert, headline: copy.overdueHeadline, instruction: copy.overdueInstruction[props.language] };
  }
  const meta = STATE_META[state];
  return { tone: meta.tone, Icon: meta.icon, headline: meta.headline, instruction };
}

function LanguageToggle({ language, onChange }: { language: Language; onChange: (language: Language) => void }) {
  return (
    <Tabs value={language} onValueChange={(value) => onChange(value as Language)}>
      <TabsList aria-label="Language / भाषा" className="h-11">
        <TabsTrigger value="en" lang="en" className="min-w-12 text-[0.9375rem]">EN</TabsTrigger>
        <TabsTrigger value="hi" lang="hi" className="min-w-12 text-[0.9375rem]">हिं</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function Row({ icon, title, detail, sub }: { icon: ReactNode; title: string; detail?: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-label">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.8125rem] text-label-2">{title}</p>
        {detail && <p className="text-[1.0625rem] font-medium leading-snug">{detail}</p>}
        {sub && <p className="text-[0.9375rem] text-label-2">{sub}</p>}
      </div>
    </div>
  );
}

export default function RiderView(props: RiderViewProps) {
  const {
    language, workerName, activeMinutes, workflowStatus, route, audioUrl, audioError, audioRef,
    stale, error, lastUpdatedAt, mode, pending, accepted, fitConfirmed, signedOut, sessionLink,
    onLanguage, onRespond, onResume, onFitChange, onReplay, onRetry,
  } = props;

  const now = useNow(1000);
  const band = bandFor(props);
  const name = workerName ?? (language === "hi" ? "राइडर" : "The rider");
  const flow = workflowStatus ? workflowLine[workflowStatus] : undefined;
  const hi = language === "hi";

  const secondsAgo =
    lastUpdatedAt && now !== null ? Math.max(0, Math.round((now - lastUpdatedAt.getTime()) / 1000)) : null;
  const updated =
    secondsAgo === null
      ? null
      : secondsAgo < 90
        ? fill(copy.updatedSeconds[language], { n: secondsAgo })
        : fill(copy.updatedMinutes[language], { n: Math.round(secondsAgo / 60) });

  const walkMinutes = route?.durationSeconds != null ? Math.max(1, Math.ceil(route.durationSeconds / 60)) : null;
  const meters = route ? Math.round(route.distanceMeters) : null;
  const hasRoute = Boolean(route && meters !== null);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-canvas">
      {stale && (
        <div role="status" className="flex items-center gap-2.5 bg-label px-5 py-2.5 text-[0.9375rem] text-white">
          <WifiOff aria-hidden="true" className="size-4 shrink-0" />
          <span lang={language}>
            {fill(copy.noSignal[language], { time: lastUpdatedAt ? clock(lastUpdatedAt) : "—" })}
          </span>
        </div>
      )}

      <header className="flex items-center justify-between gap-3 px-4 py-2">
        {sessionLink}
        <LanguageToggle language={language} onChange={onLanguage} />
      </header>

      {hasRoute && route && <RoutePreview route={route} className="h-44" />}

      <div className={cn("relative flex flex-1 flex-col rounded-t-[1.75rem] bg-surface px-5 pb-4 pt-6", hasRoute ? "-mt-5" : "mt-2")}>
        {band ? (
          <section aria-live="polite" aria-label="Safety status">
            <div className="flex items-center gap-3.5">
              <span className={cn("grid size-12 shrink-0 place-items-center rounded-full", TONE_CIRCLE[band.tone])}>
                <band.Icon aria-hidden="true" className="size-6" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <h1 lang={language} className={cn("text-[1.5rem] font-semibold", hi ? "leading-[1.4]" : "leading-tight tracking-tight")}>
                  {band.headline[language]}
                </h1>
                <p lang={other(language)} className={cn("text-[0.9375rem] text-label-2", other(language) === "hi" && "leading-relaxed")}>
                  {band.headline[other(language)]}
                </p>
              </div>
            </div>

            <p className="mt-5 text-[1.0625rem] leading-relaxed">{band.instruction}</p>

            <p className="mt-3 text-[0.9375rem] text-label-2">
              {name}
              {activeMinutes !== null && activeMinutes > 0 && (
                <>
                  {" · "}
                  <span lang={language}>{fill(copy.activeFor[language], { n: activeMinutes })}</span>
                </>
              )}
              {updated && (
                <>
                  {" · "}
                  <span lang={language}>{updated}</span>
                </>
              )}
            </p>

            {flow && (
              <p lang={language} className={cn("mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.875rem] font-medium", TONE_PILL.wait)}>
                <Hourglass aria-hidden="true" className="size-3.5" />
                {flow[language]}
              </p>
            )}
          </section>
        ) : (
          <section aria-live="polite" className="space-y-4" aria-label={copy.loading.en}>
            <div className="flex items-center gap-3.5">
              <Skeleton className="size-12 rounded-full" />
              <Skeleton className="h-6 w-48" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <p lang={language} className="text-[0.9375rem] text-label-2">{copy.loading[language]}</p>
          </section>
        )}

        {error && (
          <div role="alert" className="mt-5 rounded-2xl bg-critical-tint p-4 text-[0.9375rem] text-critical-ink">
            <p>{error}</p>
            <Button variant="secondary" className="mt-3" onClick={onRetry}>
              <span lang={language}>{copy.retry[language]}</span>
            </Button>
          </div>
        )}

        {(route || audioUrl) && (
          <div className="mt-6 divide-y divide-black/5 overflow-hidden rounded-2xl bg-fill">
            {route && meters !== null && (
              <Row
                icon={<MapPin aria-hidden="true" className="size-5" />}
                title={copy.shade[language]}
                detail={route.restPointName}
                sub={
                  walkMinutes !== null
                    ? fill(copy.walk[language], { m: meters, t: walkMinutes })
                    : fill(copy.walkShort[language], { m: meters })
                }
              />
            )}
            {audioUrl && (
              <button type="button" onClick={onReplay} className="block w-full text-left">
                <Row icon={<Volume2 aria-hidden="true" className="size-5" />} title={copy.hearHelp[language]} detail={copy.hear[language]} />
              </button>
            )}
          </div>
        )}
        {audioUrl && <audio ref={audioRef} preload="none" />}
        {audioError && (
          <p role="alert" className="mt-2 text-[0.9375rem] text-critical-ink">
            {audioError}
          </p>
        )}

        {mode === "readonly" && (
          <div className="mt-6 rounded-2xl bg-fill p-4">
            <p lang={language} className="text-[0.9375rem] leading-relaxed">
              {fill(copy.readonly[language], { name })}
            </p>
            {signedOut && (
              <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "mt-3")}>
                <span lang={language}>{copy.signIn[language]}</span>
              </Link>
            )}
          </div>
        )}

        {mode === "resting-readonly" && (
          <div className="mt-6 rounded-2xl bg-rest-tint p-4">
            <p lang={language} className="text-[0.9375rem] leading-relaxed">
              {fill(copy.restingReadonly[language], { name })}
            </p>
            {signedOut && (
              <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "mt-3")}>
                <span lang={language}>{copy.signIn[language]}</span>
              </Link>
            )}
          </div>
        )}

        {(mode === "resume" || mode === "resume-symptom") && (
          <div className="mt-6">
            <h2 lang={language} className="text-[1.0625rem] font-semibold">{copy.resumeTitle[language]}</h2>
            <p lang={language} className="mt-1 text-[0.9375rem] leading-relaxed text-label-2">
              {mode === "resume" ? copy.resumeHelp[language] : copy.resumeSymptomHelp[language]}
            </p>
          </div>
        )}

        {mode === "info" && accepted && (
          <p role="status" lang={language} className="mt-6 text-[0.9375rem] text-label-2">
            {copy.accepted[language]}
          </p>
        )}

        <p lang={language} className="mt-auto pt-8 text-[0.8125rem] text-label-2">{copy.demo[language]}</p>
      </div>

      <div className="sticky bottom-0 bg-surface px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 shadow-[0_-1px_0_rgba(0,0,0,0.05)]">
        {mode === "act" && (
          <Button size="xl" className="w-full" disabled={pending} onClick={() => onRespond("TAKE_BREAK")}>
            {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Pause aria-hidden="true" />}
            <span lang={language}>{pending ? copy.sending[language] : copy.takeBreak[language]}</span>
          </Button>
        )}

        {mode === "resume-symptom" && (
          <label className="mb-3 flex min-h-12 items-start gap-3 text-[1.0625rem]">
            <input
              type="checkbox"
              checked={fitConfirmed}
              onChange={(event) => onFitChange(event.target.checked)}
              className="mt-0.5 size-6 shrink-0 accent-black"
            />
            <span lang={language}>{copy.fit[language]}</span>
          </label>
        )}

        {(mode === "resume" || mode === "resume-symptom") && (
          <Button
            size="xl"
            className="w-full"
            disabled={pending || (mode === "resume-symptom" && !fitConfirmed)}
            onClick={onResume}
          >
            <span lang={language}>{pending ? copy.resuming[language] : copy.resume[language]}</span>
          </Button>
        )}

        <div className={cn("grid gap-3", mode === "act" ? "mt-3 grid-cols-2" : mode === "info" || mode === "readonly" || mode === "resting-readonly" ? "grid-cols-1" : "mt-3 grid-cols-1")}>
          {mode === "act" && (
            <Button variant="danger" size="xl" className="h-14 px-3 text-base" disabled={pending} onClick={() => onRespond("FEEL_UNWELL")}>
              <HeartPulse aria-hidden="true" />
              <span lang={language}>{copy.feelUnwell[language]}</span>
            </Button>
          )}
          <a
            href="tel:112"
            className={cn(buttonVariants({ variant: "danger", size: "xl" }), "h-14 px-3 text-base")}
          >
            <Phone aria-hidden="true" />
            <span lang={language}>{copy.call[language]}</span>
          </a>
        </div>

        <p lang={language} className="mt-2.5 text-center text-[0.8125rem] text-label-2">
          {copy.noCall[language]}
        </p>
      </div>
    </main>
  );
}
