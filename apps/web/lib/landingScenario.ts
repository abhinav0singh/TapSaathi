export type WalkthroughStep = "ready" | "heat" | "break" | "unwell" | "acknowledged" | "resumed";
export type WalkthroughWorkerState = "SAFE" | "CAUTION" | "HIGH" | "RESTING" | "AWAITING_SUPERVISOR";

export type WalkthroughState = {
  step: WalkthroughStep;
  ravi: WalkthroughWorkerState;
  asha: WalkthroughWorkerState;
  deliveryOwner: "Ravi" | "Asha";
  riderMessage: string;
  supervisorMessage: string;
  audit: string[];
};

const states: Record<WalkthroughStep, WalkthroughState> = {
  ready: {
    step: "ready",
    ravi: "SAFE",
    asha: "SAFE",
    deliveryOwner: "Ravi",
    riderMessage: "Your shift is active. Take regular breaks.",
    supervisorMessage: "No rider follow-up is needed.",
    audit: ["Monitoring heat and active time"],
  },
  heat: {
    step: "heat",
    ravi: "HIGH",
    asha: "SAFE",
    deliveryOwner: "Ravi",
    riderMessage: "Heat risk is high. Go to the nearby shaded rest point.",
    supervisorMessage: "Ravi has received bilingual guidance and a rest route.",
    audit: ["Heat-risk policy matched", "Guidance and rest route prepared", "Waiting for Ravi’s choice"],
  },
  break: {
    step: "break",
    ravi: "RESTING",
    asha: "SAFE",
    deliveryOwner: "Asha",
    riderMessage: "Your break is active. Rest and hydrate.",
    supervisorMessage: "Delivery coverage is confirmed; no supervisor action is needed.",
    audit: ["Ravi chose a break", "delivery-001 reassigned to Asha", "Ravi is resting"],
  },
  unwell: {
    step: "unwell",
    ravi: "AWAITING_SUPERVISOR",
    asha: "SAFE",
    deliveryOwner: "Asha",
    riderMessage: "Stay somewhere safe. Your supervisor has been alerted.",
    supervisorMessage: "Ravi reported feeling unwell. Review and acknowledge the follow-up.",
    audit: ["Ravi reported feeling unwell", "Delivery secured with Asha", "Supervisor follow-up requested"],
  },
  acknowledged: {
    step: "acknowledged",
    ravi: "AWAITING_SUPERVISOR",
    asha: "SAFE",
    deliveryOwner: "Asha",
    riderMessage: "Your supervisor has seen this. Return only if you feel well enough.",
    supervisorMessage: "Follow-up acknowledged. Ravi may self-declare readiness when appropriate.",
    audit: ["Supervisor acknowledged follow-up", "Ravi may self-declare readiness", "Delivery remains with Asha"],
  },
  resumed: {
    step: "resumed",
    ravi: "SAFE",
    asha: "SAFE",
    deliveryOwner: "Asha",
    riderMessage: "You are back in the normal flow. Take regular breaks.",
    supervisorMessage: "The follow-up is complete. Delivery remains with Asha.",
    audit: ["Ravi self-declared readiness", "Rider resumed work", "Outcome recorded"],
  },
};

export function walkthroughState(step: WalkthroughStep): WalkthroughState {
  return states[step];
}

export function nextWalkthroughStep(
  current: WalkthroughStep,
  action: "TRIGGER_HEAT" | "TAKE_BREAK" | "FEEL_UNWELL" | "ACKNOWLEDGE" | "RESUME" | "RESTART",
): WalkthroughStep {
  const transitions: Record<WalkthroughStep, Partial<Record<typeof action, WalkthroughStep>>> = {
    ready: { TRIGGER_HEAT: "heat", RESTART: "ready" },
    heat: { TAKE_BREAK: "break", FEEL_UNWELL: "unwell", RESTART: "ready" },
    break: { RESTART: "ready" },
    unwell: { ACKNOWLEDGE: "acknowledged", RESTART: "ready" },
    acknowledged: { RESUME: "resumed", RESTART: "ready" },
    resumed: { RESTART: "ready" },
  };

  return transitions[current][action] ?? current;
}
