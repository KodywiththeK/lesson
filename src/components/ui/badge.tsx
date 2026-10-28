import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-border bg-white text-slate-900 [a&]:hover:bg-slate-100",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/70",
        destructive:
          "bg-destructive-soft text-destructive-soft-foreground focus-visible:ring-destructive/20 [a&]:hover:bg-destructive-soft/70",
        success:
          "bg-success-soft text-success-soft-foreground [a&]:hover:bg-success-soft/70",
        warning:
          "bg-warning-soft text-warning-soft-foreground [a&]:hover:bg-warning-soft/70",
        info: "bg-info-soft text-info-soft-foreground [a&]:hover:bg-info-soft/70",
        outline:
          "border-border bg-white text-slate-900 [a&]:hover:bg-slate-100",
        ghost: "border-border bg-white text-slate-900 [a&]:hover:bg-slate-100",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
