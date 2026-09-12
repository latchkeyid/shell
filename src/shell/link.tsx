import * as React from "react"

import { useShellOptional } from "./shell-context"
import type { LinkProps } from "./types"

/** Plain anchor used when no LinkComponent is supplied. */
export const AnchorLink = React.forwardRef<HTMLAnchorElement, LinkProps>(
  function AnchorLink({ href, ...props }, ref) {
    return <a ref={ref} href={href} {...props} />
  },
)

/**
 * Renders through the app's LinkComponent so the shell stays router-agnostic.
 * Falls back to a plain anchor that calls onNavigate on click.
 */
export const ShellLink = React.forwardRef<HTMLAnchorElement, LinkProps>(
  function ShellLink({ href, onClick, ...props }, ref) {
    const shell = useShellOptional()
    const Component = shell?.LinkComponent ?? AnchorLink
    if (Component !== AnchorLink) {
      return <Component ref={ref} href={href} onClick={onClick} {...props} />
    }
    return (
      <AnchorLink
        ref={ref}
        href={href}
        onClick={(event) => {
          onClick?.(event)
          if (event.defaultPrevented || !shell) return
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          event.preventDefault()
          shell.navigate(href)
        }}
        {...props}
      />
    )
  },
)
