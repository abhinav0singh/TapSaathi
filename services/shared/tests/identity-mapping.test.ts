import { describe, expect, it } from "vitest";
import { loadIdentityMapping } from "../src/identity-mapping.js";

const operatorSub = "11111111-1111-4111-8111-111111111111";
const raviSub = "22222222-2222-4222-8222-222222222222";
const nehaSub = "33333333-3333-4333-8333-333333333333";

function load(value?: string) {
  return loadIdentityMapping(
    value === undefined
      ? {}
      : { DEMO_IDENTITY_MAPPING: value }
  );
}

describe("Cognito identity mapping configuration", () => {
  it("accepts valid operator, worker and supervisor mappings", () => {
    const mapping = {
      [operatorSub]: { role: "OPERATOR" },
      [raviSub]: { role: "WORKER", actorId: "ravi-001" },
      [nehaSub]: {
        role: "SUPERVISOR",
        actorId: "supervisor-neha-001",
      },
    };

    expect(load(JSON.stringify(mapping))).toEqual(mapping);
  });

  it("rejects missing configuration", () => {
    expect(() => load()).toThrowError(
      expect.objectContaining({
        code: "IDENTITY_MAPPING_UNAVAILABLE",
        statusCode: 500,
      })
    );
  });

  it("rejects malformed JSON", () => {
    expect(() => load("{invalid")).toThrowError(
      expect.objectContaining({
        code: "IDENTITY_MAPPING_INVALID",
      })
    );
  });

  it("rejects empty mappings", () => {
    expect(() => load("{}")).toThrowError(
      expect.objectContaining({
        code: "IDENTITY_MAPPING_INVALID",
      })
    );
  });

  it("rejects invalid Cognito subject IDs", () => {
    expect(() => load(JSON.stringify({
      "not-a-uuid": { role: "OPERATOR" },
    }))).toThrowError(
      expect.objectContaining({
        code: "IDENTITY_MAPPING_INVALID",
      })
    );
  });

  it("rejects unknown roles", () => {
    expect(() => load(JSON.stringify({
      [operatorSub]: { role: "ADMIN" },
    }))).toThrowError(
      expect.objectContaining({
        code: "IDENTITY_MAPPING_INVALID",
      })
    );
  });

  it("rejects workers mapped to unauthorized actors", () => {
    expect(() => load(JSON.stringify({
      [raviSub]: {
        role: "WORKER",
        actorId: "supervisor-neha-001",
      },
    }))).toThrowError(
      expect.objectContaining({
        code: "IDENTITY_MAPPING_INVALID",
      })
    );
  });

  it("rejects supervisor mappings to worker identities", () => {
    expect(() => load(JSON.stringify({
      [nehaSub]: {
        role: "SUPERVISOR",
        actorId: "ravi-001",
      },
    }))).toThrowError(
      expect.objectContaining({
        code: "IDENTITY_MAPPING_INVALID",
      })
    );
  });

  it("rejects unexpected mapping properties", () => {
    expect(() => load(JSON.stringify({
      [operatorSub]: {
        role: "OPERATOR",
        actorId: "ravi-001",
      },
    }))).toThrowError(
      expect.objectContaining({
        code: "IDENTITY_MAPPING_INVALID",
      })
    );
  });
});
