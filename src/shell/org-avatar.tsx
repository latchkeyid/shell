import * as React from "react"

import { cn } from "@/lib/utils"
import { initials } from "@/lib/text"

const sizes = {
  16: "size-4 rounded-[4px] text-[9px]",
  20: "size-5 rounded-[5px] text-[10px]",
  24: "size-6 rounded-[5px] text-[10px]",
  28: "size-7 rounded-md text-xs",
  32: "size-8 rounded-md text-sm",
} as const

export interface OrgAvatarProps extends React.ComponentProps<"span"> {
  name: string
  src?: string
  size?: keyof typeof sizes
  /** Accent gradient (the current org); otherwise a neutral tile. */
  tone?: "accent" | "neutral"
}

/** Logo if present, else two-letter initials on the accent gradient. */
export function OrgAvatar({
  name,
  src,
  size = 32,
  tone = "accent",
  className,
  ...props
}: OrgAvatarProps) {
  return (
    <span
      data-slot="org-avatar"
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden font-semibold leading-none select-none",
        sizes[size],
        tone === "accent"
          ? "bg-accent-gradient text-primary-foreground shadow-[0_1px_2px_rgb(0_0_0/0.25),inset_0_1px_0_rgb(255_255_255/0.25)]"
          : "bg-foreground/10 text-foreground",
        className,
      )}
      {...props}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  )
}
