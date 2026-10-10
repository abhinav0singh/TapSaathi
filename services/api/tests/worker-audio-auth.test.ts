import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { AppError } from "@taapsaathi/shared";

const mocks = vi.hoisted(() => ({
  loadRuntimeIdentityMapping: vi.fn(),
  getWorker: vi.fn(),
  getIntervention: vi.fn(),
  getSignedUrl: vi.fn(),
}));

vi.mock("@taapsaathi/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@taapsaathi/shared")>();

  return {
    ...actual,
    loadRuntimeIdentityMapping: mocks.loadRuntimeIdentityMapping,
    DynamoRepository: class {
      getWorker = mocks.getWorker;
      getIntervention = mocks.getIntervention;
    },
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mocks.getSignedUrl,
}));

import { handler } from "../src/worker-audio.js";

const raviSub = "22222222-2222-4222-8222-222222222222";
const ashaSub = "33333333-3333-4333-8333-333333333333";

const mapping = {
  [raviSub]: { role: "WORKER", actorId: "ravi-001" },
  [ashaSub]: { role: "WORKER", actorId: "asha-001" },
};

function event(
  sub: string | undefined,
  workerId = "ravi-001"
): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    headers: {},
    pathParameters: { workerId },
    requestContext: {
      requestId: "req-test",
      ...(sub
        ? {
            authorizer: {
              jwt: {
                claims: { sub, "cognito:groups": ["WORKER"] },
                scopes: null,
              },
            },
          }
        : {}),
    },
  } as unknown as APIGatewayProxyEventV2;
}

async function invoke(request: APIGatewayProxyEventV2) {
  const result = await handler(request, {} as never, () => undefined);

  if (!result || typeof result === "string") {
    throw new Error("Unexpected Lambda response");
  }

  return result;
}

describe("Worker audio API authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["TABLE_NAME"] = "TestTable";
    process.env["AUDIO_BUCKET_NAME"] = "test-audio-bucket";
    mocks.loadRuntimeIdentityMapping.mockResolvedValue(mapping);
    mocks.getWorker.mockResolvedValue({
      workerId: "ravi-001",
      activeInterventionId: "int-test-001",
    });
    mocks.getIntervention.mockResolvedValue({
      interventionId: "int-test-001",
      audioKey: "audio/hi/ravi-001.mp3",
    });
    mocks.getSignedUrl.mockResolvedValue("https://signed.example/audio.mp3");
  });

  it("rejects missing JWT before reading DynamoDB or signing audio", async () => {
    const result = await invoke(event(undefined));

    expect(result.statusCode).toBe(401);
    expect(mocks.getWorker).not.toHaveBeenCalled();
    expect(mocks.getIntervention).not.toHaveBeenCalled();
    expect(mocks.getSignedUrl).not.toHaveBeenCalled();
  });

  it("rejects Ravi requesting Asha's audio before reading DynamoDB", async () => {
    const result = await invoke(event(raviSub, "asha-001"));

    expect(result.statusCode).toBe(403);
    expect(mocks.getWorker).not.toHaveBeenCalled();
    expect(mocks.getIntervention).not.toHaveBeenCalled();
    expect(mocks.getSignedUrl).not.toHaveBeenCalled();
  });

  it("allows the mapped rider to retrieve only their guidance audio", async () => {
    const result = await invoke(event(raviSub));

    expect(result.statusCode).toBe(200);
    expect(mocks.getWorker).toHaveBeenCalledWith("ravi-001");
    expect(mocks.getIntervention).toHaveBeenCalledWith("int-test-001");
    expect(mocks.getSignedUrl).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(result.body))).toMatchObject({
      audioUrl: "https://signed.example/audio.mp3",
      audioExpiresAt: expect.any(String),
    });
  });

  it("fails closed before reading DynamoDB when identity mapping is unavailable", async () => {
    mocks.loadRuntimeIdentityMapping.mockRejectedValue(
      new AppError(
        "IDENTITY_MAPPING_UNAVAILABLE",
        "Demo identity configuration is unavailable.",
        500
      )
    );

    const result = await invoke(event(raviSub));

    expect(result.statusCode).toBe(500);
    expect(mocks.getWorker).not.toHaveBeenCalled();
    expect(mocks.getIntervention).not.toHaveBeenCalled();
    expect(mocks.getSignedUrl).not.toHaveBeenCalled();
  });
});
