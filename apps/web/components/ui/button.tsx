import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/*
  Uber-style buttons: true black primary, soft gray secondary, no outlines.
  Weight stays at medium; size and spacing carry the hierarchy.
*/
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-xl text-[0.9375rem] font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-rest/50 active:not-aria-[haspopup]:scale-[0.99] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1.125rem]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/85",
        secondary: "bg-black/[0.06] text-foreground hover:bg-black/[0.1]",
        outline: "bg-surface text-foreground shadow-[inset_0_0_0_1px_var(--separator)] hover:bg-fill",
        ghost: "text-foreground hover:bg-black/[0.06]",
        destructive: "bg-critical-tint text-critical-ink hover:bg-critical-tint/70",
        danger: "bg-black/[0.06] text-critical-ink hover:bg-black/[0.1]",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 gap-2 px-4",
        xs: "h-7 gap-1 rounded-lg px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-9 gap-1.5 rounded-lg px-3 text-sm",
        lg: "h-12 gap-2 px-5 text-base",
        xl: "h-14 gap-2.5 rounded-2xl px-6 text-[1.0625rem] [&_svg:not([class*='size-'])]:size-5",
        icon: "size-10",
        "icon-sm": "size-9 rounded-lg",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
