"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type Option<T extends string> = { value: T; label: ReactNode; lang?: string }

/**
 * An iOS-style segmented control for choosing one value from a few (language, a scenario). It is
 * a group of toggle buttons, not tabs: there are no panels, so it uses aria-pressed.
 */
function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "default",
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: Option<T>[]
  label: string
  size?: "default" | "lg"
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex w-fit max-w-full flex-wrap items-center rounded-[0.65rem] bg-fill-strong/70 p-0.5", className)}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            lang={option.lang}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-[0.5rem] px-3 text-sm font-medium whitespace-nowrap transition-colors",
              size === "lg" ? "min-h-10 min-w-12 text-[0.9375rem]" : "min-h-9",
              active ? "bg-surface text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-foreground/60 hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export { Segmented }
