"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  Language,
  ResponseAction,
  WorkerViewResponseSchema,
} from "@taapsaathi/contracts";
import type { z } from "zod";
import { api } from "@/lib/api";
import { latestSupervisorOutcome } from "@/lib/supervisorOutcome";
import { useAuditEvents } from "@/lib/useAuditEvents";
import RoutePreview from "@/components/worker/RoutePreview";
import RiderSessionLink from "@/components/worker/RiderSessionLink";
import { useIdentity } from "@/components/useIdentity";
import { hasRole } from "@/lib/auth";

type WorkerView = z.infer<typeof WorkerViewResponseSchema>;

const copy = {
  en: {
    title: "Your safety comes first",
    subtitle: "Live safety guidance",
    takeBreak: "Take a break",
    feelUnwell: "I feel unwell",
    submitting: "Submitting...",
    replay: "Play safety guidance",
    route: "Nearest rest point",
    emergency: "Call 112",
    disclaimer: "TaapSaathi has not placed an emergency call.",
    waiting: "Waiting for a safety update",
    noAction: "No worker response is currently available.",
    stale: "Connection interrupted. Showing last known information.",
    accepted: "Response received. Waiting for backend confirmation.",
    acknowledgedStatus: "SUPERVISOR ACKNOWLEDGED",
    acknowledgedInstruction: "Your supervisor acknowledged the alert. Stay in a safe place until you are cleared to resume work.",
    acknowledgedResponse: "Acknowledgment recorded. You are not yet cleared to resume work.",
    overdueStatus: "SUPERVISOR RESPONSE OVERDUE",
    overdueInstruction: "No supervisor acknowledgment was recorded in time. Stay in a safe place and seek help.",
    overdueResponse: "The supervisor response window ended without acknowledgment.",
    resumeTitle: "Ready to return?",
    resumeHelp: "After resting and hydrating, confirm when you are ready. Your previous delivery stays reassigned.",
    resume: "I am ready to resume work",
    resuming: "Updating work status...",
    riderSessionRequired: "This is a read-only preview. Ravi must use his signed-in rider session to respond.",
    resumeSessionRequired: "After resting and hydrating, Ravi can return to SAFE from his authenticated rider session. The previous delivery stays reassigned.",
    signIn: "Open rider sign-in",
  },
  hi: {
    title: "आपकी सुरक्षा सबसे पहले",
    subtitle: "सुरक्षा संबंधी जानकारी",
    takeBreak: "ब्रेक लें",
    feelUnwell: "मेरी तबीयत खराब है",
    submitting: "भेजा जा रहा है...",
    replay: "सुरक्षा संदेश सुनें",
    route: "नज़दीकी विश्राम स्थल",
    emergency: "112 पर कॉल करें",
    disclaimer: "TaapSaathi ने आपातकालीन कॉल नहीं की है।",
    waiting: "सुरक्षा जानकारी की प्रतीक्षा है",
    noAction: "अभी कोई प्रतिक्रिया उपलब्ध नहीं है।",
    stale: "कनेक्शन बाधित है। पिछली जानकारी दिखाई जा रही है।",
    accepted: "जवाब प्राप्त हुआ। सर्वर से पुष्टि की प्रतीक्षा है।",
    acknowledgedStatus: "सुपरवाइज़र ने पुष्टि की",
    acknowledgedInstruction: "सुपरवाइज़र ने अलर्ट स्वीकार कर लिया है। काम पर लौटने की अनुमति मिलने तक सुरक्षित स्थान पर रहें।",
    acknowledgedResponse: "पुष्टि दर्ज हो गई है। आपको अभी काम पर लौटने की अनुमति नहीं मिली है।",
    overdueStatus: "सुपरवाइज़र का जवाब लंबित है",
    overdueInstruction: "समय पर सुपरवाइज़र की पुष्टि दर्ज नहीं हुई। सुरक्षित स्थान पर रहें और मदद लें।",
    overdueResponse: "सुपरवाइज़र से पुष्टि की अवधि बिना जवाब के समाप्त हो गई।",
    resumeTitle: "काम पर लौटने के लिए तैयार हैं?",
    resumeHelp: "आराम और पानी पीने के बाद तैयार होने पर पुष्टि करें। पिछली डिलीवरी दूसरे राइडर के पास रहेगी।",
    resume: "मैं काम पर लौटने के लिए तैयार हूँ",
    resuming: "काम की स्थिति अपडेट हो रही है...",
    riderSessionRequired: "यह केवल देखने के लिए है। जवाब देने के लिए रवि को अपने राइडर खाते से साइन इन करना होगा।",
    resumeSessionRequired: "आराम और पानी पीने के बाद रवि अपने राइडर खाते से SAFE स्थिति में लौट सकता है। पिछली डिलीवरी दूसरे राइडर के पास रहेगी।",
    signIn: "राइडर साइन-इन खोलें",
  },
} as const;

const statusStyles: Record<string, string> = {
  SAFE: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CAUTION: "bg-amber-50 text-amber-800 border-amber-200",
  HIGH: "bg-orange-50 text-orange-800 border-orange-200",
  CRITICAL: "bg-red-50 text-red-800 border-red-200",
  RESTING: "bg-blue-50 text-blue-800 border-blue-200",
  AWAITING_SUPERVISOR: "bg-violet-50 text-violet-800 border-violet-200",
};

export default function RiderExperience({
  workerId,
}: {
  workerId: string;
}) {
  const [data, setData] = useState<WorkerView | null>(null);
  const [language, setLanguage] = useState<Language>("en");
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [pending, setPending] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const identity = useIdentity();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const resumeRequestIdRef = useRef<string | null>(null);

  const t = copy[language];
  const auditEvents = useAuditEvents(
    data?.worker.demoGeneration,
    data?.worker.state === "AWAITING_SUPERVISOR" && !data.intervention,
    (events) => Boolean(data && latestSupervisorOutcome(events, workerId, data.worker.demoGeneration))
  );
  const supervisorOutcome = data?.worker.state === "AWAITING_SUPERVISOR" && !data.intervention
    ? latestSupervisorOutcome(auditEvents, workerId, data.worker.demoGeneration)
    : null;

  const refresh = useCallback(async () => {
    try {
      const result = await api.worker(workerId);
      setData(result);
      setError(null);
      setStale(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load worker.");
      setStale(true);
    }
  }, [workerId]);

  useEffect(() => {
    const saved = window.localStorage.getItem("taapsaathi-language");
    if (saved === "en" || saved === "hi") setLanguage(saved);
    else if (data?.worker.language) setLanguage(data.worker.language);
  }, [data?.worker.language]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setAccepted(false);
    requestIdRef.current = null;
  }, [data?.intervention?.interventionId]);

  const isRiderSession =
    identity.status === "signed-in" &&
    hasRole(identity.identity, "WORKER") &&
    identity.identity.actorId === workerId;
  const awaitingWorker =
    data?.intervention?.status === "AWAITING_WORKER" &&
    data.worker.activeInterventionId === data.intervention.interventionId &&
    !accepted &&
    !stale;
  const actionable = awaitingWorker && isRiderSession;
  const canResume =
    data?.worker.state === "RESTING" &&
    !data.worker.activeInterventionId &&
    isRiderSession &&
    !stale;

  useEffect(() => {
    const interval = window.setInterval(
      () => void refresh(),
      awaitingWorker ? 2000 : 5000
    );

    return () => window.clearInterval(interval);
  }, [refresh, awaitingWorker]);

  function changeLanguage(value: Language) {
    setLanguage(value);
    window.localStorage.setItem("taapsaathi-language", value);
  }

  async function respond(action: Extract<ResponseAction, "TAKE_BREAK" | "FEEL_UNWELL">) {
    if (!actionable || pending || !data?.intervention) return;

    const interventionId = data.intervention.interventionId;
    const clientRequestId = requestIdRef.current ?? crypto.randomUUID();
    requestIdRef.current = clientRequestId;

    setPending(true);
    setError(null);

    try {
      await api.respond(interventionId, {
        actorId: workerId,
        actorType: "WORKER",
        action,
        language,
        clientRequestId,
      });

      setAccepted(true);
      requestIdRef.current = null;
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Response failed.");
    } finally {
      setPending(false);
    }
  }

  async function replayAudio() {
    if (!data?.audioUrl || !audioRef.current) return;

    setAudioError(null);

    try {
      audioRef.current.src = data.audioUrl;
      await audioRef.current.play();
    } catch {
      setAudioError("Audio playback is unavailable. Read the instruction above.");
    }
  }

  async function resumeWork() {
    if (!canResume || pending) return;

    const clientRequestId = resumeRequestIdRef.current ?? crypto.randomUUID();
    resumeRequestIdRef.current = clientRequestId;
    setPending(true);
    setError(null);

    try {
      await api.resumeWorker(workerId, { actorId: workerId, clientRequestId });
      resumeRequestIdRef.current = null;
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resume work.");
    } finally {
      setPending(false);
    }
  }

  const route = data?.route;

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-5 text-slate-900">
      <div className="mx-auto max-w-md space-y-5">
        <header className="flex items-center justify-between gap-3">
          <RiderSessionLink />

          <div className="flex rounded-full border border-slate-200 bg-white p-1">
            {(["en", "hi"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => changeLanguage(value)}
                aria-pressed={language === value}
                className={`min-h-10 rounded-full px-4 text-sm font-semibold ${
                  language === value
                    ? "bg-slate-900 text-white"
                    : "text-slate-600"
                }`}
              >
                {value === "en" ? "EN" : "हिं"}
              </button>
            ))}
          </div>
        </header>

        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-orange-600">
            TAAPSAATHI
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            {t.title}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {data?.worker.name ?? workerId} · {t.subtitle}
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
            <button onClick={() => void refresh()} className="ml-2 underline">
              Retry
            </button>
          </div>
        )}

        {stale && data && (
          <div role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            {t.stale}
          </div>
        )}

        {!data ? (
          <div className="rounded-2xl bg-white p-8 text-center">
            {t.waiting}
          </div>
        ) : (
          <>
            <section className={`rounded-2xl border p-6 shadow-sm ${statusStyles[data.worker.state] ?? "bg-white"}`} aria-live="polite">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold tracking-[0.16em]">CURRENT SAFETY STATUS</p>
                  <p className="mt-1 text-lg font-bold">
                    {supervisorOutcome?.status === "ACKNOWLEDGED"
                      ? t.acknowledgedStatus
                      : supervisorOutcome?.status === "UNACKNOWLEDGED"
                        ? t.overdueStatus
                        : data.worker.state.replaceAll("_", " ")}
                  </p>
                </div>
                {data.intervention && (
                  <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold">
                    {data.intervention.riskLevel} risk
                  </span>
                )}
              </div>
              <p className="mt-4 text-xl font-semibold leading-relaxed">
                {supervisorOutcome?.status === "ACKNOWLEDGED"
                  ? t.acknowledgedInstruction
                  : supervisorOutcome?.status === "UNACKNOWLEDGED"
                    ? t.overdueInstruction
                    : data.instruction}
              </p>
              {data.intervention && (
                <p className="mt-4 text-sm">
                  Workflow: {data.intervention.status.replaceAll("_", " ")}
                </p>
              )}
            </section>

            {route && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="font-bold">{t.route}</h2>
                <p className="mt-3 text-lg font-semibold">{route.restPointName}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {(route.distanceMeters / 1000).toFixed(1)} km
                  {route.durationSeconds !== null
                    ? ` · ${Math.ceil(route.durationSeconds / 60)} min`
                    : ""}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {route.provider === "AMAZON_LOCATION"
                    ? "Route provided by Amazon Location"
                    : "Approximate route information"}
                </p>
                <RoutePreview route={route} />
              </section>
            )}

            {data.audioUrl && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <button
                  type="button"
                  onClick={() => void replayAudio()}
                  className="min-h-12 w-full rounded-xl bg-slate-900 px-4 font-semibold text-white"
                >
                  ▶ {t.replay}
                </button>
                <audio ref={audioRef} preload="none" />
                {audioError && (
                  <p role="alert" className="mt-3 text-sm text-red-700">
                    {audioError}
                  </p>
                )}
              </section>
            )}

            <section className="space-y-3">
              {actionable ? (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void respond("TAKE_BREAK")}
                    className="min-h-14 w-full rounded-2xl bg-emerald-600 px-5 text-lg font-bold text-white disabled:opacity-50"
                  >
                    {pending ? t.submitting : t.takeBreak}
                  </button>

                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void respond("FEEL_UNWELL")}
                    className="min-h-14 w-full rounded-2xl border border-red-300 bg-red-50 px-5 text-lg font-bold text-red-800 disabled:opacity-50"
                  >
                    {pending ? t.submitting : t.feelUnwell}
                  </button>
                </>
              ) : awaitingWorker ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
                  <p className="text-sm leading-relaxed text-slate-700">{t.riderSessionRequired}</p>
                  {identity.status === "anonymous" && (
                    <Link
                      href="/login"
                      className="mt-4 inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-bold text-white"
                    >
                      {t.signIn}
                    </Link>
                  )}
                </div>
              ) : canResume ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <h2 className="text-lg font-bold text-emerald-950">{t.resumeTitle}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-emerald-900">{t.resumeHelp}</p>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void resumeWork()}
                    className="mt-4 min-h-14 w-full rounded-xl bg-emerald-700 px-5 text-base font-bold text-white disabled:opacity-50"
                  >
                    {pending ? t.resuming : t.resume}
                  </button>
                </div>
              ) : data.worker.state === "RESTING" ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-center">
                  <p className="text-sm leading-relaxed text-blue-900">{t.resumeSessionRequired}</p>
                  {identity.status === "anonymous" && (
                    <Link
                      href="/login"
                      className="mt-4 inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-bold text-white"
                    >
                      {t.signIn}
                    </Link>
                  )}
                </div>
              ) : (
                <div role="status" className="rounded-xl bg-white p-4 text-center text-sm text-slate-600">
                  {supervisorOutcome?.status === "ACKNOWLEDGED"
                    ? t.acknowledgedResponse
                    : supervisorOutcome?.status === "UNACKNOWLEDGED"
                      ? t.overdueResponse
                      : accepted ? t.accepted : t.noAction}
                </div>
              )}
            </section>
          </>
        )}

        <section className="rounded-2xl border border-red-200 bg-white p-5">
          <a
            href="tel:112"
            className="flex min-h-12 items-center justify-center rounded-xl bg-red-600 px-4 text-lg font-bold text-white"
          >
            {t.emergency}
          </a>
          <p className="mt-3 text-center text-xs text-slate-600">
            {t.disclaimer}
          </p>
        </section>

        <p className="pb-5 text-center text-xs text-slate-400">
          Simulated demonstration environment
        </p>
      </div>
    </main>
  );
}
