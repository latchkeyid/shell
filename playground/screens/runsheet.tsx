import * as React from "react"
import {
  BookOpenIcon,
  CalendarClockIcon,
  ExternalLinkIcon,
  PhoneCallIcon,
  PlayIcon,
  PlugIcon,
  RotateCcwIcon,
  ServerIcon,
  SirenIcon,
  UsersIcon,
} from "lucide-react"

import { toast, toastUndo } from "@/actions/toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/data/empty-state"
import { formatDateTime, formatDuration, formatTime } from "@/data/formatters"
import { Id } from "@/data/id"
import { Level } from "@/data/level"
import { ListRow, ListRows } from "@/data/list-row"
import { Metric } from "@/data/metric"
import { StatusDot } from "@/data/status-dot"
import { AppShell } from "@/shell/app-shell"
import { PageActionBar, PageTitle } from "@/shell/page-action-bar"
import type { NavGroup, ScopeConfig } from "@/shell/types"

import { incidents, runs, type Run } from "../fixtures/data"
import { parsePath, type ScreenProps } from "./types"

const teams = [
  { id: "platform-sre", label: "platform-sre", secondary: "team", icon: UsersIcon },
  { id: "payments", label: "payments", secondary: "team", icon: UsersIcon },
  { id: "edge", label: "edge", secondary: "service", icon: ServerIcon },
  { id: "postgres", label: "postgres", secondary: "service", icon: ServerIcon },
]

function nav(org: string, team: string): NavGroup[] {
  const t = `/o/${org}/t/${team}`
  return [
    {
      id: "runbooks",
      label: "Runbooks",
      items: [
        { id: "runbooks", label: "Runbooks", href: `${t}/runbooks`, icon: BookOpenIcon, count: 14 },
        { id: "runs", label: "Runs", href: `${t}/runs`, icon: PlayIcon },
        { id: "schedules", label: "Schedules", href: `${t}/schedules`, icon: CalendarClockIcon },
      ],
    },
    {
      id: "incidents",
      label: "Incidents",
      items: [
        { id: "incidents", label: "Incidents", href: `${t}/incidents`, icon: SirenIcon, count: 1 },
        { id: "on-call", label: "On-call", href: `${t}/on-call`, icon: PhoneCallIcon },
      ],
    },
    {
      id: "settings",
      label: "Settings",
      items: [
        { id: "team", label: "Team", href: `/o/${org}/members`, icon: UsersIcon },
        { id: "integrations", label: "Integrations", href: `/o/${org}/integrations`, icon: PlugIcon },
      ],
    },
  ]
}

const severityClass = {
  sev1: "border-destructive-border text-destructive",
  sev2: "border-warning-border text-warning",
  sev3: "border-info-border text-info",
} as const
const incidentTone = { open: "danger", mitigated: "warning", resolved: "success" } as const

export function RunsheetScreen({ session, path, navigate, callbacks, LinkComponent }: ScreenProps) {
  const { segments } = parsePath(path)
  const org = segments[1] ?? session.currentOrg ?? "runsheet"
  const team = segments[3] ?? "platform-sre"
  const [history, setHistory] = React.useState<Run[]>(runs)
  const [selected, setSelected] = React.useState<string | null>(null)

  const scope: ScopeConfig = {
    noun: "team",
    items: teams,
    current: team,
    recent: ["edge"],
    href: `/o/${org}/t/${team}/runbooks`,
    onSelect: (item) => item && navigate(`/o/${org}/t/${item.id}/runbooks`),
  }

  const rerun = (run: Run) => {
    const next: Run = { ...run, id: `run_${Math.random().toString(36).slice(2, 8)}`, startedAt: new Date().toISOString(), outcome: "ok", startedBy: "chris" }
    setHistory((prev) => [next, ...prev])
    toastUndo(`Started ${run.runbook}`, { onUndo: () => setHistory((prev) => prev.filter((item) => item.id !== next.id)) })
  }

  return (
    <AppShell
      app={{ id: "runsheet", name: "runsheet" }}
      session={session}
      nav={nav(org, team)}
      scope={scope}
      registry={{
        placeholder: "Search runbooks, incidents…",
        searchGroup: "Runbooks",
        search: async (q) =>
          [...new Set(runs.map((run) => run.runbook))]
            .filter((name) => name.toLowerCase().includes(q.toLowerCase()))
            .map((name) => ({ id: `runbook:${name}`, label: name, icon: BookOpenIcon, run: () => toast(`Open ${name}`) })),
        pages: [{ id: "start-run", label: "Start a run…", group: "Actions", icon: PlayIcon, run: () => toast("Start run is a page in the real app") }],
      }}
      callbacks={callbacks}
      LinkComponent={LinkComponent}
      currentPath={path}
      onNavigate={navigate}
      seedPins={["runbooks", "incidents"]}
    >
      <PageActionBar
        breadcrumbs={[{ label: "Runbooks" }]}
        searchPlaceholder="Search runbooks, incidents…"
        actions={
          <Button size="sm" onClick={() => toast("Start run is a page in the real app")}>
            <PlayIcon strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
            Start run
          </Button>
        }
      />
      <main className="flex flex-col gap-4 p-4">
        <PageTitle>Runbooks</PageTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card size="sm">
            <CardContent>
              <Metric label="Runs today" value="18" detail="3 scheduled" />
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <Metric label="Failed (7d)" value="2" detail="of 61 runs" />
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <Metric label="p50 duration" value={formatDuration(184_000)} detail="last 7 days" />
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <Metric label="Open incidents" value="1" detail="1 mitigated" />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Recent runs</h2>
            {history.length === 0 ? (
              <EmptyState variant="blank-slate" title="No runs yet" description="Start a run from a runbook." />
            ) : (
              <ListRows>
                {history.map((run) => (
                  <ListRow
                    key={run.id}
                    onClick={() => setSelected(run.id)}
                    selected={selected === run.id}
                    tone={run.outcome === "failed" ? "danger" : undefined}
                    status={<Level level={run.outcome} label="" aria-label={run.outcome} />}
                    title={run.runbook}
                    meta={
                      <>
                        <Id value={run.id} copy={false} /> · {run.service} · by {run.startedBy} · {run.steps.done}/{run.steps.total} steps
                      </>
                    }
                    trailing={
                      <>
                        <span>{run.outcome === "skipped" ? "—" : formatDuration(run.durationMs)}</span>
                        <time dateTime={run.startedAt} title={formatDateTime(run.startedAt)}>
                          {formatTime(run.startedAt)}
                        </time>
                      </>
                    }
                    actions={
                      <>
                        <Button variant="ghost" size="icon-xs" aria-label={`Re-run ${run.runbook}`} onClick={() => rerun(run)}>
                          <RotateCcwIcon />
                        </Button>
                        <Button variant="ghost" size="icon-xs" aria-label={`Open ${run.runbook}`} onClick={() => toast(`Open ${run.id}`)}>
                          <ExternalLinkIcon />
                        </Button>
                      </>
                    }
                  />
                ))}
              </ListRows>
            )}
          </section>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Incidents</CardTitle>
              <CardDescription>Active and recently resolved in {team}.</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {incidents.map((incident) => (
                <ListRow
                  key={incident.id}
                  href={`/o/${org}/t/${team}/incidents/${incident.id}`}
                  status={
                    <Badge variant="outline" className={severityClass[incident.severity]}>
                      {incident.severity.toUpperCase()}
                    </Badge>
                  }
                  title={incident.title}
                  meta={
                    <>
                      {incident.id} · commander {incident.commander} · opened {formatTime(incident.openedAt)}
                    </>
                  }
                  trailing={<StatusDot tone={incidentTone[incident.status]}>{incident.status}</StatusDot>}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </AppShell>
  )
}
