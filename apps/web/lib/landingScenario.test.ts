import { describe, expect, it } from "vitest";
import { nextWalkthroughStep, walkthroughState } from "./landingScenario";

describe("landing walkthrough", () => {
  it("keeps the phone, map and delivery view on the same local heat-risk scenario", () => {
    const heat = walkthroughState(nextWalkthroughStep("ready", "TRIGGER_HEAT"));
    expect(heat.ravi).toBe("HIGH");
    expect(heat.deliveryOwner).toBe("Ravi");

    const breakState = walkthroughState(nextWalkthroughStep("heat", "TAKE_BREAK"));
    expect(breakState.ravi).toBe("RESTING");
    expect(breakState.deliveryOwner).toBe("Asha");
  });

  it("secures the delivery before the supervisor path and requires acknowledgement before resume", () => {
    const unwell = walkthroughState(nextWalkthroughStep("heat", "FEEL_UNWELL"));
    expect(unwell.ravi).toBe("AWAITING_SUPERVISOR");
    expect(unwell.deliveryOwner).toBe("Asha");
    expect(nextWalkthroughStep("unwell", "RESUME")).toBe("unwell");
    expect(nextWalkthroughStep("acknowledged", "RESUME")).toBe("resumed");
  });

  it("does not allow impossible transitions", () => {
    expect(nextWalkthroughStep("ready", "ACKNOWLEDGE")).toBe("ready");
    expect(nextWalkthroughStep("break", "FEEL_UNWELL")).toBe("break");
  });
});
