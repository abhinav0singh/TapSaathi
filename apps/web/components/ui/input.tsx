import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/utils"

/* iOS-style field: soft gray fill, no outline until focused. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-xl bg-fill px-4 text-base transition-colors outline-none placeholder:text-label-3 focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-rest/60 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-critical/50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
