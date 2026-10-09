import { describe, expect, it, vi } from "vitest";
import { GetParameterCommand } from "@aws-sdk/client-ssm";
import { loadRuntimeIdentityMapping } from "../src/runtime-identity-mapping.js";

const operatorSub = "11111111-1111-4111-8111-111111111111";
const raviSub = "22222222-2222-4222-8222-222222222222";

const mapping = {
  [operatorSub]: { role: "OPERATOR" },
  [raviSub]: { role: "WORKER", actorId: "ravi-001" },
};

const parameterName = "/taapsaathi/demo/identity-mapping";

describe("SSM runtime identity mapping", () => {
  it("loads and validates the identity mapping", async () => {
    const send = vi.fn().mockResolvedValue({
      Parameter: {
        Value: JSON.stringify(mapping),
      },
    });

    const result = await loadRuntimeIdentityMapping(
      parameterName,
      { send } as never
    );

    expect(result).toEqual(mapping);
    expect(send).toHaveBeenCalledTimes(1);

    const command = send.mock.calls[0]?.[0];

    expect(command).toBeInstanceOf(GetParameterCommand);
    expect((command as GetParameterCommand).input).toMatchObject({
      Name: parameterName,
      WithDecryption: true,
    });
  });

  it("rejects missing parameter names without calling AWS", async () => {
    const send = vi.fn();

    await expect(
      loadRuntimeIdentityMapping("", { send } as never)
    ).rejects.toMatchObject({
      code: "IDENTITY_MAPPING_UNAVAILABLE",
    });

    expect(send).not.toHaveBeenCalled();
  });

  it("rejects parameters without values", async () => {
    const send = vi.fn().mockResolvedValue({
      Parameter: {},
    });

    await expect(
      loadRuntimeIdentityMapping(parameterName, { send } as never)
    ).rejects.toMatchObject({
      code: "IDENTITY_MAPPING_UNAVAILABLE",
    });
  });

  it("rejects malformed JSON from Parameter Store", async () => {
    const send = vi.fn().mockResolvedValue({
      Parameter: {
        Value: "{invalid",
      },
    });

    await expect(
      loadRuntimeIdentityMapping(parameterName, { send } as never)
    ).rejects.toMatchObject({
      code: "IDENTITY_MAPPING_INVALID",
    });
  });

  it("rejects invalid identity mappings", async () => {
    const send = vi.fn().mockResolvedValue({
      Parameter: {
        Value: JSON.stringify({
          [operatorSub]: {
            role: "WORKER",
            actorId: "unknown-worker",
          },
        }),
      },
    });

    await expect(
      loadRuntimeIdentityMapping(parameterName, { send } as never)
    ).rejects.toMatchObject({
      code: "IDENTITY_MAPPING_INVALID",
    });
  });

  it("propagates AWS access-denied errors", async () => {
    const error = new Error("Access denied");
    error.name = "AccessDeniedException";

    const send = vi.fn().mockRejectedValue(error);

    await expect(
      loadRuntimeIdentityMapping(parameterName, { send } as never)
    ).rejects.toBe(error);
  });

  it("propagates missing-parameter AWS errors", async () => {
    const error = new Error("Parameter not found");
    error.name = "ParameterNotFound";

    const send = vi.fn().mockRejectedValue(error);

    await expect(
      loadRuntimeIdentityMapping(parameterName, { send } as never)
    ).rejects.toBe(error);
  });

  it("does not cache identity mappings between requests", async () => {
    const send = vi.fn()
      .mockResolvedValueOnce({
        Parameter: {
          Value: JSON.stringify(mapping),
        },
      })
      .mockResolvedValueOnce({
        Parameter: {
          Value: JSON.stringify({
            [operatorSub]: { role: "OPERATOR" },
          }),
        },
      });

    const client = { send } as never;

    const first = await loadRuntimeIdentityMapping(
      parameterName,
      client
    );

    const second = await loadRuntimeIdentityMapping(
      parameterName,
      client
    );

    expect(first).toHaveProperty(raviSub);
    expect(second).not.toHaveProperty(raviSub);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
