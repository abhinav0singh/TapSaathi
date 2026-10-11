import { describe, expect, it } from "vitest";
import { canUseDemoControls, demoControlErrorMessage } from "./demoControls";

describe("canUseDemoControls", () => {
  it("shows the controls to the operator and the supervisor only", () => {
    expect(canUseDemoControls(["OPERATOR"])).toBe(true);
    expect(canUseDemoControls(["SUPERVISOR"])).toBe(true);
    expect(canUseDemoControls(["WORKER"])).toBe(false);
    expect(canUseDemoControls([])).toBe(false);
  });

  it("does not match partial or differently cased group names", () => {
    expect(canUseDemoControls(["operator"])).toBe(false);
    expect(canUseDemoControls(["OPERATORS"])).toBe(false);
    expect(canUseDemoControls(["SUPERVISOR_READONLY"])).toBe(false);
  });
});

describe("demoControlErrorMessage", () => {
  it("keeps the server's reason in one sentence", () => {
    expect(demoControlErrorMessage("reset the demo", new Error("A reset is already running"))).toBe("Could not reset the demo. A reset is already running.");
  });

  it("explains an access error that a supervisor may see before the backend is updated", () => {
    const message = demoControlErrorMessage("start a heat spike", new Error("Operator access required."));
    expect(message).toContain("Could not start a heat spike. Operator access required.");
    expect(message).toContain("supervisor");
  });

  it("turns bare gateway refusals into plain advice", () => {
    expect(demoControlErrorMessage("reset the demo", new Error("API request failed: 401"))).toBe("Could not reset the demo. Your sign-in was not accepted. Sign out and sign in again.");
    expect(demoControlErrorMessage("start a heat spike", new Error("API request failed: 403"))).toBe("Could not start a heat spike. This account is not allowed to do that.");
    expect(demoControlErrorMessage("reset the demo", new Error("API request failed: 500"))).toBe("Could not reset the demo. API request failed: 500.");
  });

  it("falls back to a plain retry message", () => {
    expect(demoControlErrorMessage("reset the demo", "boom")).toBe("Could not reset the demo. Please try again.");
  });
});
