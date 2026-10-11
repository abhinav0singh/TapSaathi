import { describe, expect, it } from "vitest";
import { eventText } from "./auditText";

const base = { actorType: "SYSTEM" as const, details: {} };

describe("eventText", () => {
  it("describes a rider choosing to take a break", () => {
    expect(eventText({ eventType: "RESPONSE_ACCEPTED", actorType: "WORKER", details: { action: "TAKE_BREAK" } }, "Ravi")).toBe(
      "Ravi chose to take a break",
    );
  });

  it("describes a rider reporting symptoms", () => {
    expect(eventText({ eventType: "RESPONSE_ACCEPTED", actorType: "WORKER", details: { action: "FEEL_UNWELL" } }, "Ravi")).toBe(
      "Ravi reported feeling unwell",
    );
  });

  it("describes a supervisor acknowledgment", () => {
    expect(eventText({ eventType: "RESPONSE_ACCEPTED", actorType: "SUPERVISOR", details: { action: "SUPERVISOR_ACK" } }, "Ravi")).toBe(
      "Supervisor acknowledged",
    );
  });

  it("explains how an alert ended", () => {
    expect(eventText({ eventType: "INTERVENTION_COMPLETED", actorType: "SYSTEM", details: { terminalStatus: "SUPERVISOR_UNACKNOWLEDGED" } }, "Ravi")).toBe(
      "No supervisor acknowledged in time",
    );
  });

  it("falls back to readable words for unknown events", () => {
    expect(eventText({ ...base, eventType: "GUIDANCE_READY" }, "Ravi")).toBe("Guidance ready");
  });
});
