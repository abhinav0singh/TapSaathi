import { createHash, randomUUID } from "node:crypto";
import type { Handler } from "aws-lambda";
import { CalculateRoutesCommand, GeoRoutesClient } from "@aws-sdk/client-geo-routes";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Position, RestPoint, RouteView } from "@taapsaathi/contracts";
import { createAudit, DynamoRepository, loadEnvironment, log } from "@taapsaathi/shared";
import { selectShortestSuccessfulRoute } from "./guidance.js";
import type { WorkflowState } from "./workflow-input.js";

function distanceMeters(origin: Position, destination: Position): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLatitude = radians(destination[1] - origin[1]);
  const deltaLongitude = radians(destination[0] - origin[0]);
  const latitude1 = radians(origin[1]);
  const latitude2 = radians(destination[1]);
  const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function fallbackRoute(origin: Position, points: RestPoint[], now: string): RouteView {
  const selected = [...points].sort((a, b) => distanceMeters(origin, a.position) - distanceMeters(origin, b.position))[0];
  if (!selected) throw new Error("No seeded rest points available");
  return {
    provider: "STRAIGHT_LINE_FALLBACK",
    available: false,
    distanceMeters: distanceMeters(origin, selected.position),
    durationSeconds: null,
    restPointId: selected.restPointId,
    restPointName: selected.name,
    geometry: { type: "LineString", coordinates: [origin, selected.position] },
    generatedAt: now,
  };
}

async function amazonRoute(origin: Position, points: RestPoint[], now: string): Promise<RouteView> {
  const client = new GeoRoutesClient({});
  const results: RouteView[] = [];
  for (const point of points) {
    try {
      const response = await client.send(new CalculateRoutesCommand({
        Origin: origin,
        Destination: point.position,
        TravelMode: "Scooter",
        LegGeometryFormat: "Simple",
      }));
      const candidate = response.Routes?.[0];
      if (!candidate?.Summary) continue;
      const coordinates = candidate.Legs?.flatMap((leg) => leg.Geometry?.LineString ?? []) ?? [];
      results.push({
        provider: "AMAZON_LOCATION",
        available: true,
        distanceMeters: candidate.Summary.Distance ?? 0,
        durationSeconds: candidate.Summary.Duration ?? 0,
        restPointId: point.restPointId,
        restPointName: point.name,
        geometry: { type: "LineString", coordinates: coordinates.length >= 2 ? coordinates as Position[] : [origin, point.position] },
        generatedAt: now,
      });
    } catch (error) {
      log("WARN", "CalculateRouteFailed", { restPointId: point.restPointId, errorName: error instanceof Error ? error.name : "Unknown" });
    }
  }
  const selected = selectShortestSuccessfulRoute(results);
  if (!selected) throw new Error("Amazon Location returned no successful route");
  return selected;
}

export function guidanceMessage(language: "en" | "hi", workerName: string): string {
  return language === "hi"
    ? `${workerName}, गर्मी का खतरा अधिक है। कृपया काम रोकें और बताए गए विश्राम स्थान पर जाएँ।`
    : `${workerName}, heat risk is high. Please stop work and go to the shown rest point.`;
}

async function audio(language: "en" | "hi", bucket: string, interventionId: string, workerName: string): Promise<string> {
  const message = guidanceMessage(language, workerName);
  const key = `audio/${language}/${createHash("sha256").update(`${language}:${message}`).digest("hex")}.mp3`;
  const s3 = new S3Client({});
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return key;
  } catch {
    const response = await new PollyClient({}).send(new SynthesizeSpeechCommand({
      Engine: "standard",
      LanguageCode: language === "hi" ? "hi-IN" : "en-IN",
      OutputFormat: "mp3",
      Text: message,
      VoiceId: "Aditi",
    }));
    if (!response.AudioStream) throw new Error("Polly returned no audio stream");
    const bytes = await response.AudioStream.transformToByteArray();
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: "audio/mpeg", Metadata: { interventionId } }));
    return key;
  }
}

export const handler: Handler<WorkflowState> = async (input) => {
  const environment = loadEnvironment();
  if (!environment.AUDIO_BUCKET_NAME) throw new Error("AUDIO_BUCKET_NAME is required");
  if (!input.workerPosition || !input.workerLanguage) throw new Error("Workflow context is incomplete");
  const repository = new DynamoRepository(environment.TABLE_NAME);
  const worker = await repository.getWorker(input.envelope.payload.workerId);
  if (!worker) throw new Error("Worker not found for guidance preparation");
  const points = await repository.getRestPoints(input.envelope.payload.hubId);
  const now = new Date().toISOString();
  let route: RouteView;
  let failure: "GUIDANCE_ROUTE_FAILED" | "GUIDANCE_AUDIO_FAILED" | undefined;
  try { route = await amazonRoute(input.workerPosition, points, now); }
  catch { route = fallbackRoute(input.workerPosition, points, now); failure = "GUIDANCE_ROUTE_FAILED"; }
  let audioKey: string | undefined;
  try { audioKey = await audio(input.workerLanguage, environment.AUDIO_BUCKET_NAME, input.interventionId, worker.name); }
  catch (error) { failure = "GUIDANCE_AUDIO_FAILED"; log("ERROR", "GenerateAudioFailed", { interventionId: input.interventionId, workerId: input.envelope.payload.workerId, errorName: error instanceof Error ? error.name : "Unknown" }); }
  await repository.updateGuidance({
    interventionId: input.interventionId,
    generation: input.envelope.demoGeneration,
    route,
    ...(audioKey ? { audioKey, audioLanguage: input.workerLanguage } : {}),
    ...(failure ? { failure } : {}),
    now,
    audit: createAudit({ auditEventId: `audit-guidance-${randomUUID()}`, interventionId: input.interventionId, eventType: "GUIDANCE_PREPARED", actorType: "SYSTEM", correlationId: input.envelope.correlationId, workerId: input.envelope.payload.workerId, hubId: input.envelope.payload.hubId, demoGeneration: input.envelope.demoGeneration, details: { routeProvider: route.provider, audioCreated: Boolean(audioKey), failure: failure ?? null }, occurredAt: now }),
  });
  return input;
};
