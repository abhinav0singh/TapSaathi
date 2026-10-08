import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import type { HeatObservation, HeatRiskRaisedEnvelope } from "@taapsaathi/contracts";
import { processObservation } from "../../risk-engine/src/process-observation.js";
import type { Repository } from "./repository.js";

type EventBridge = Pick<EventBridgeClient, "send">;

export interface PublishObservationInput {
  observation: HeatObservation;
  repository: Repository;
  eventBridge: EventBridge;
  eventBusName: string;
  maxContinuousMinutes: number;
  correlationId: string;
  now: string;
}

export async function evaluateAndPublishObservation(input: PublishObservationInput): Promise<{
  events: HeatRiskRaisedEnvelope[];
  failedEntries: number;
}> {
  const generation = await input.repository.getDemoGeneration();
  const workers = await input.repository.getWorkers(input.observation.hubId);
  await input.repository.putObservation(input.observation, generation);
  const result = processObservation(input.observation, {
    workers,
    demoGeneration: generation,
    maxContinuousMinutes: input.maxContinuousMinutes,
    correlationId: input.correlationId,
    now: input.now,
  });
  if (result.events.length === 0) return { events: [], failedEntries: 0 };
  const response = await input.eventBridge.send(new PutEventsCommand({
    Entries: result.events.map((event) => ({
      Source: "taapsaathi.risk-engine",
      DetailType: "HeatRiskRaised",
      EventBusName: input.eventBusName,
      Detail: JSON.stringify(event),
      Time: new Date(event.occurredAt),
    })),
  }));
  const failedEntries = response.FailedEntryCount ?? 0;
  if (failedEntries > 0) throw new Error(`EventBridge rejected ${failedEntries} risk event(s)`);
  return { events: result.events, failedEntries };
}
