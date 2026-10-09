"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Language,
  ResponseAction,
  WorkerViewResponseSchema,
} from "@taapsaathi/contracts";
import type { z } from "zod";
import { api } from "@/lib/api";
import RoutePreview from "@/components/worker/RoutePreview";
import RiderSessionLink from "@/components/worker/RiderSessionLink";

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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestIdRef = useRef<string | null>(null);

  const t = copy[language];

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

  const actionable =
    data?.intervention?.status === "AWAITING_WORKER" &&
    data.worker.activeInterventionId === data.intervention.interventionId &&
    !accepted &&
    !stale;

  useEffect(() => {
    const interval = window.setInterval(
      () => void refresh(),
      actionable ? 2000 : 5000
    );

    return () => window.clearInterval(interval);
  }, [refresh, actionable]);

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
                    {data.worker.state.replaceAll("_", " ")}
                  </p>
                </div>
                {data.intervention && (
                  <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold">
                    {data.intervention.riskLevel} risk
                  </span>
                )}
              </div>
              <p className="mt-4 text-xl font-semibold leading-relaxed">
                {data.instruction}
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
              ) : (
                <div role="status" className="rounded-xl bg-white p-4 text-center text-sm text-slate-600">
                  {accepted ? t.accepted : t.noAction}
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
