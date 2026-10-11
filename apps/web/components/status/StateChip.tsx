import type { RiskState } from "@taapsaathi/contracts";
import { cn } from "@/lib/utils";
import { STATE_META, TONE_PILL, type StateTone } from "@/components/status/stateMeta";

type Props = {
  state: RiskState;
  /** Override the wording, e.g. "Acknowledged" for a supervisor outcome. */
  label?: string;
  tone?: StateTone;
  className?: string;
};

/** A small pill: pale tint, matching ink, icon and word, so it reads without color. */
export default function StateChip({ state, label, tone, className }: Props) {
  const meta = STATE_META[state];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8125rem] font-medium leading-none",
        TONE_PILL[tone ?? meta.tone],
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" strokeWidth={2.2} />
      {label ?? meta.short.en}
    </span>
  );
}
