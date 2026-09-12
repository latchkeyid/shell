import * as React from "react"
import { CheckIcon, CopyIcon, MailIcon, PlusIcon } from "lucide-react"

import { Button } from "../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { roleLabel } from "../lib/text"
import { OrgAvatar } from "./org-avatar"
import type { ShellInvitation, ShellSession } from "./types"

export interface WelcomePageProps {
  session: ShellSession
  appName: string
  onAccept: (invitation: ShellInvitation) => void | Promise<void>
  onDecline: (invitation: ShellInvitation) => void | Promise<void>
  onCreateOrg?: () => void
}

/** Full-page zero-org state: invitations as cards, create if allowed, else ask an admin. */
export function WelcomePage({ session, appName, onAccept, onDecline, onCreateOrg }: WelcomePageProps) {
  const [copied, setCopied] = React.useState(false)
  const [pending, setPending] = React.useState<string | null>(null)

  const act = async (invitation: ShellInvitation, fn: WelcomePageProps["onAccept"]) => {
    setPending(invitation.id)
    try {
      await fn(invitation)
    } finally {
      setPending(null)
    }
  }

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(session.user.email)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-16">
      <header className="grid gap-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{appName}</p>
        <h1 tabIndex={-1} className="text-xl font-semibold tracking-tight outline-none">
          Welcome, {session.user.name ?? session.user.email}
        </h1>
        <p className="text-sm text-muted-foreground">
          {session.invitations.length > 0
            ? "You have been invited to join an organisation."
            : "You are not a member of any organisation yet."}
        </p>
      </header>

      {session.invitations.map((invitation) => (
        <Card key={invitation.id} size="sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <OrgAvatar name={invitation.orgName} size={32} />
              <div className="grid min-w-0 gap-0.5">
                <CardTitle className="truncate">{invitation.orgName}</CardTitle>
                <CardDescription>
                  Invited by {invitation.invitedBy} as {roleLabel(invitation.role)}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button size="sm" disabled={pending === invitation.id} onClick={() => act(invitation, onAccept)}>
              Accept invitation
            </Button>
            <Button size="sm" variant="outline" disabled={pending === invitation.id} onClick={() => act(invitation, onDecline)}>
              Decline
            </Button>
          </CardContent>
        </Card>
      ))}

      {session.canCreateOrg && onCreateOrg ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Create an organisation</CardTitle>
            <CardDescription>Start a new organisation and invite your team.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="outline" onClick={onCreateOrg}>
              <PlusIcon strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
              Create organisation
            </Button>
          </CardContent>
        </Card>
      ) : (
        session.invitations.length === 0 && (
          <Card size="sm">
            <CardHeader>
              <CardTitle>Ask an admin to invite you</CardTitle>
              <CardDescription>
                An organisation admin can invite this address from their members page.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <span className="flex h-8 items-center gap-2 rounded-md border bg-card px-2.5 font-mono text-xs">
                <MailIcon className="size-3.5 text-muted-foreground" strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
                {session.user.email}
              </span>
              <Button size="icon-sm" variant="outline" aria-label="Copy email address" onClick={copyEmail}>
                {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
              </Button>
            </CardContent>
          </Card>
        )
      )}
    </main>
  )
}
