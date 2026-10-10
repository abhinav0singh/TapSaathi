import { randomUUID } from "node:crypto";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { DemoHeatSpikeRequestSchema, DemoHeatSpikeResponseSchema, HeatObservationSchema } from "@taapsaathi/contracts";
import { DynamoRepository, errorResponse, evaluateAndPublishObservation, json, loadEnvironment, loadRuntimeIdentityMapping, parseJson, requestContext, requireOperator } from "@taapsaathi/shared";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const context = requestContext(event);
  try {
    requireOperator(event, await loadRuntimeIdentityMapping());
    parseJson(event, DemoHeatSpikeRequestSchema);
    const environment = loadEnvironment();
    if (!environment.EVENT_BUS_NAME) throw new Error("EVENT_BUS_NAME is required");
    const now = new Date().toISOString();
    const observation = HeatObservationSchema.parse({
      schemaVersion: 1,
      observationId: `demo-${randomUUID()}`,
      source: "DEMO_SIMULATOR",
      hubId: environment.DEMO_HUB_ID,
      temperatureC: 45.2,
      relativeHumidity: 42,
      apparentTemperatureC: 49.1,
      // No official alert is asserted: the policy decides from the readings.
      officialHeatAlert: false,
      observedAt: now,
    });
    const repository = new DynamoRepository(environment.TABLE_NAME);
    const result = await evaluateAndPublishObservation({
      observation,
      repository,
      eventBridge: new EventBridgeClient({}),
      eventBusName: environment.EVENT_BUS_NAME,
      maxContinuousMinutes: environment.MAX_CONTINUOUS_MINUTES,
      correlationId: context.correlationId,
      now,
    });
    const riskEvent = result.events.find((candidate) => candidate.payload.workerId === "ravi-001");
    if (!riskEvent) throw new Error("Demo fixture did not produce Ravi's required risk event");
    return json(202, DemoHeatSpikeResponseSchema.parse({
      eventId: riskEvent.eventId,
      source: "DEMO_SIMULATOR",
      correlationId: riskEvent.correlationId,
      demoGeneration: riskEvent.demoGeneration,
      acceptedAt: now,
      simulated: true,
    }), context.correlationId);
  } catch (error) {
    return errorResponse(error, context.requestId);
  }
};
