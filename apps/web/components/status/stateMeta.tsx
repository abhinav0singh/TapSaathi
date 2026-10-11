import type { ComponentType } from "react";
import {
  CircleCheck,
  Hourglass,
  OctagonAlert,
  Pause,
  TriangleAlert,
  Flame,
  type LucideProps,
} from "lucide-react";
import type { Language, RiskState } from "@taapsaathi/contracts";

/**
 * Every risk state has a color, an icon shape and a word. Color alone is never the signal: a
 * rider with red/green color blindness still has to be able to tell SAFE from HIGH.
 */
export type StateTone = "safe" | "caution" | "high" | "critical" | "rest" | "wait";

type Bilingual = Record<Language, string>;

export type StateMeta = {
  tone: StateTone;
  icon: ComponentType<LucideProps>;
  /** Short word for chips and lists. */
  short: Bilingual;
  /** Headline the rider sees. */
  headline: Bilingual;
};

export const STATE_META: Record<RiskState, StateMeta> = {
  SAFE: {
    tone: "safe",
    icon: CircleCheck,
    short: { en: "Safe", hi: "सुरक्षित" },
    headline: { en: "You are safe", hi: "आप सुरक्षित हैं" },
  },
  CAUTION: {
    tone: "caution",
    icon: TriangleAlert,
    short: { en: "Caution", hi: "सावधान" },
    headline: { en: "Heat is building", hi: "गर्मी बढ़ रही है" },
  },
  HIGH: {
    tone: "high",
    icon: Flame,
    short: { en: "High risk", hi: "ज़्यादा ख़तरा" },
    headline: { en: "Take a break now", hi: "अभी आराम करें" },
  },
  CRITICAL: {
    tone: "critical",
    icon: OctagonAlert,
    short: { en: "Critical", hi: "गंभीर" },
    headline: { en: "Stop and get help", hi: "रुकें और मदद लें" },
  },
  RESTING: {
    tone: "rest",
    icon: Pause,
    short: { en: "Resting", hi: "आराम" },
    headline: { en: "You are resting", hi: "आप आराम कर रहे हैं" },
  },
  AWAITING_SUPERVISOR: {
    tone: "wait",
    icon: Hourglass,
    short: { en: "Waiting on supervisor", hi: "सुपरवाइज़र का इंतज़ार" },
    headline: { en: "Waiting for your supervisor", hi: "सुपरवाइज़र का इंतज़ार" },
  },
};

/** The round icon badge: solid color, glyph chosen for contrast on that color. */
export const TONE_CIRCLE: Record<StateTone, string> = {
  safe: "bg-safe text-white",
  caution: "bg-caution text-black",
  high: "bg-high text-white",
  critical: "bg-critical text-white",
  rest: "bg-rest text-white",
  wait: "bg-wait text-white",
};

/** Soft pill: pale tint with the darker ink of the same hue. */
export const TONE_PILL: Record<StateTone, string> = {
  safe: "bg-safe-tint text-safe-ink",
  caution: "bg-caution-tint text-caution-ink",
  high: "bg-high-tint text-high-ink",
  critical: "bg-critical-tint text-critical-ink",
  rest: "bg-rest-tint text-rest-ink",
  wait: "bg-wait-tint text-wait-ink",
};

export const TONE_TINT: Record<StateTone, string> = {
  safe: "bg-safe-tint",
  caution: "bg-caution-tint",
  high: "bg-high-tint",
  critical: "bg-critical-tint",
  rest: "bg-rest-tint",
  wait: "bg-wait-tint",
};

export const TONE_DOT: Record<StateTone, string> = {
  safe: "bg-safe",
  caution: "bg-caution",
  high: "bg-high",
  critical: "bg-critical",
  rest: "bg-rest",
  wait: "bg-wait",
};

/** Hex values for places that cannot use Tailwind classes (the Leaflet map). */
export const TONE_HEX: Record<StateTone, string> = {
  safe: "#34c759",
  caution: "#ffb800",
  high: "#ee6300",
  critical: "#ff3b30",
  rest: "#007aff",
  wait: "#8e8e93",
};

/** Most urgent first: the order a person scanning a list should meet them in. */
export const URGENCY_ORDER: RiskState[] = [
  "CRITICAL",
  "HIGH",
  "AWAITING_SUPERVISOR",
  "CAUTION",
  "RESTING",
  "SAFE",
];

export function urgencyRank(state: RiskState): number {
  return URGENCY_ORDER.indexOf(state);
}
