"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Language, ResponseAction, WorkerViewResponseSchema } from "@taapsaathi/contracts";
import type { z } from "zod";
import { api } from "@/lib/api";
import { latestSupervisorOutcome } from "@/lib/supervisorOutcome";
import { useAuditEvents } from "@/lib/useAuditEvents";
import RiderSessionLink from "@/components/worker/RiderSessionLink";
import RiderView, { type RiderMode } from "@/components/rider/RiderView";
import { useIdentity } from "@/components/useIdentity";
import { hasRole } from "@/lib/auth";

type WorkerView = z.infer<typeof WorkerViewResponseSchema>;

/** Data, identity and actions for one rider. All presentation lives in RiderView. */
export default function RiderExperience({ workerId }: { workerId: string }) {
  const [data, setData] = useState<WorkerView | null>(null);
  const [language, setLanguage] = useState<Language>("en");
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [pending, setPending] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const identity = useIdentity();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const resumeRequestIdRef = useRef<string | null>(null);
  const [fitConfirmed, setFitConfirmed] = useState(false);

  const auditEvents = useAuditEvents(
    data?.worker.demoGeneration,
    data?.worker.state === "AWAITING_SUPERVISOR" && !data.intervention,
    (events) => Boolean(data && latestSupervisorOutcome(events, workerId, data.worker.demoGeneration)),
  );
  const supervisorOutcome =
    data?.worker.state === "AWAITING_SUPERVISOR" && !data.intervention
      ? latestSupervisorOutcome(auditEvents, workerId, data.worker.demoGeneration)
      : null;

  const refresh = useCallback(async () => {
    try {
      const result = await api.worker(workerId);
      setData(result);
      setError(null);
      setStale(false);
      setLastUpdatedAt(new Date());
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
    data?.worker.state === "RESTING" && !data.worker.activeInterventionId && isRiderSession && !stale;
  const canResumeAfterSymptom =
    data?.worker.state === "AWAITING_SUPERVISOR" &&
    !data.worker.activeInterventionId &&
    !data.intervention &&
    supervisorOutcome?.status === "ACKNOWLEDGED" &&
    isRiderSession &&
    !stale;

  useEffect(() => {
    let cancelled = false;
    if (!isRiderSession || !data?.intervention) {
      setAudioUrl(null);
      return;
    }
    void api
      .workerAudio(workerId)
      .then((result) => {
        if (!cancelled) setAudioUrl(result.audioUrl);
      })
      .catch(() => {
        if (!cancelled) setAudioUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [data?.intervention?.updatedAt, isRiderSession, workerId]);

  useEffect(() => {
    const interval = window.setInterval(() => void refresh(), awaitingWorker ? 2000 : 5000);
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
    if (!audioUrl || !audioRef.current) return;
    setAudioError(null);
    try {
      audioRef.current.src = audioUrl;
      await audioRef.current.play();
    } catch {
      setAudioError("Audio playback is unavailable. Read the instruction above.");
    }
  }

  async function resumeWork() {
    if (!(canResume || (canResumeAfterSymptom && fitConfirmed)) || pending) return;

    const clientRequestId = resumeRequestIdRef.current ?? crypto.randomUUID();
    resumeRequestIdRef.current = clientRequestId;
    setPending(true);
    setError(null);

    try {
      await api.resumeWorker(workerId, {
        actorId: workerId,
        clientRequestId,
        ...(canResumeAfterSymptom ? { selfDeclaredFit: true as const } : {}),
      });
      setFitConfirmed(false);
      resumeRequestIdRef.current = null;
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resume work.");
    } finally {
      setPending(false);
    }
  }

  let mode: RiderMode = "info";
  if (actionable) mode = "act";
  else if (awaitingWorker) mode = "readonly";
  else if (canResume) mode = "resume";
  else if (canResumeAfterSymptom) mode = "resume-symptom";
  else if (data?.worker.state === "RESTING") mode = "resting-readonly";

  return (
    <RiderView
      language={language}
      workerName={data?.worker.name ?? null}
      activeMinutes={data?.worker.activeMinutes ?? null}
      state={data?.worker.state ?? null}
      outcome={supervisorOutcome?.status ?? null}
      instruction={data?.instruction ?? ""}
      workflowStatus={data?.intervention?.status ?? null}
      route={data?.route ?? null}
      audioUrl={audioUrl}
      audioError={audioError}
      audioRef={audioRef}
      stale={stale && data !== null}
      error={error}
      lastUpdatedAt={lastUpdatedAt}
      mode={mode}
      pending={pending}
      accepted={accepted}
      fitConfirmed={fitConfirmed}
      signedOut={identity.status === "anonymous"}
      sessionLink={<RiderSessionLink />}
      onLanguage={changeLanguage}
      onRespond={(action) => void respond(action)}
      onResume={() => void resumeWork()}
      onFitChange={setFitConfirmed}
      onReplay={() => void replayAudio()}
      onRetry={() => void refresh()}
    />
  );
}
