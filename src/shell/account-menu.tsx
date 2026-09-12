import { CheckIcon, LogOutIcon, MailIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { initials } from "@/lib/text"
import { useShell } from "@/shell/shell-context"
import { useTheme } from "@/shell/theme-provider"
import type { ThemeMode } from "@/shell/types"

const themeOptions: Array<{ value: ThemeMode; label: string; icon: typeof SunIcon }> = [
  { value: "system", label: "System", icon: MonitorIcon },
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
]

/** Avatar trigger in the action bar: identity, theme, invitations, sign out. */
export function AccountMenu() {
  const { session, callbacks, paths, navigate } = useShell()
  const { mode, setMode } = useTheme()
  const { user } = session
  const label = user.name ?? user.email
  const inviteCount = session.invitations.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account: ${label}`}
          data-slot="account-menu-trigger"
          className="flex size-8 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Avatar size="sm" className="after:hidden">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
            <AvatarFallback className="bg-[linear-gradient(135deg,var(--accent-soft),color-mix(in_srgb,var(--primary)_35%,var(--card)))] text-2xs font-semibold text-primary">
              {initials(label)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-60 rounded-xl">
        <DropdownMenuLabel className="grid gap-0.5 font-normal">
          {user.name && <span className="truncate text-sm font-medium">{user.name}</span>}
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-2xs tracking-wide text-muted-foreground uppercase">Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={mode}
            onValueChange={(value) => {
              const next = value as ThemeMode
              setMode(next)
              callbacks.onTheme?.(next)
            }}
          >
            {themeOptions.map(({ value, label: text, icon: Icon }) => (
              <DropdownMenuRadioItem key={value} value={value} className="pr-2 pl-2 [&>span:first-child]:hidden">
                <Icon strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
                <span className="flex-1">{text}</span>
                {mode === value && <CheckIcon className="size-3.5 text-primary" aria-hidden="true" />}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate(paths.invitations)}>
          <MailIcon strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
          <span className="flex-1">Invitations</span>
          {inviteCount > 0 && <span className="font-mono text-2xs text-muted-foreground tabular-nums">{inviteCount}</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void callbacks.onSignOut?.()}>
          <LogOutIcon strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
