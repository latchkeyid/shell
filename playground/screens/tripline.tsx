import * as React from "react"
import {
  BarChart3Icon,
  BellIcon,
  BellOffIcon,
  BugIcon,
  CreditCardIcon,
  FolderIcon,
  GaugeIcon,
  KeyRoundIcon,
  MailIcon,
  SettingsIcon,
  TagIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react"
import type { RowSelectionState } from "@tanstack/react-table"

import { ConfirmDialog } from "@/actions/confirm-dialog"
import { InlineMessage } from "@/actions/inline-message"
import { toast } from "@/actions/toast"
import { useOptimisticAction } from "@/actions/use-optimistic-action"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable, createColumns } from "@/data/data-table"
import { DetailSheet } from "@/data/detail-sheet"
import { formatDateTime, formatDuration, formatNumber, formatTime } from "@/data/formatters"
import { Id } from "@/data/id"
import { Level } from "@/data/level"
import { Metric } from "@/data/metric"
import { StatusDot } from "@/data/status-dot"
import { AppShell } from "@/shell/app-shell"
import { PageActionBar, PageTitle } from "@/shell/page-action-bar"
import { useCommands } from "@/shell/shell-context"
import type { CommandItem, EnvironmentConfig, NavGroup, ScopeConfig } from "@/shell/types"

import { issues as seedIssues, transactions, type Issue } from "../fixtures/data"
import { searchPlatformOrgs } from "../fixtures/sessions"
import { parsePath, withQuery, type ScreenProps } from "./types"

const projects = [
  { id: "mobile", label: "mobile", secondary: "React Native" },
  { id: "backend", label: "backend", secondary: "Go" },
  { id: "web", label: "web", secondary: "Next.js" },
  { id: "loom", label: "loom", secondary: "Rust" },
]

const environments: EnvironmentConfig["options"] = [
  { id: "production", label: "production", tone: "warning" },
  { id: "staging", label: "staging", tone: "info" },
  { id: "development", label: "development", tone: "neutral" },
]

function nav(org: string, project: string, unresolved: number): NavGroup[] {
  const base = `/o/${org}/p/${project}`
  return [
    {
      id: "monitor",
      label: "Monitor",
      items: [
        { id: "issues", label: "Issues", href: `${base}/issues`, icon: BugIcon, count: unresolved },
        { id: "performance", label: "Performance", href: `${base}/performance`, icon: GaugeIcon },
        { id: "releases", label: "Releases", href: `${base}/releases`, icon: TagIcon },
        { id: "alerts", label: "Alerts", href: `${base}/alerts`, icon: BellIcon, count: 3 },
      ],
    },
    {
      id: "organisation",
      label: "Organisation",
      items: [
        { id: "projects", label: "Projects", href: `/o/${org}/projects`, icon: FolderIcon },
        { id: "team", label: "Team", href: `/o/${org}/members`, icon: UsersIcon },
        { id: "invitations", label: "Invitations", href: `/o/${org}/invitations`, icon: MailIcon },
        { id: "usage", label: "Usage", href: `/o/${org}/usage`, icon: BarChart3Icon },
        { id: "billing", label: "Billing", href: `/o/${org}/billing`, icon: CreditCardIcon },
      ],
    },
    {
      id: "settings",
      label: "Settings",
      items: [
        { id: "general", label: "General", href: `/o/${org}/settings`, icon: SettingsIcon, exact: true },
        { id: "api-keys", label: "API keys", href: `/o/${org}/settings/api-keys`, icon: KeyRoundIcon },
      ],
    },
  ]
}

const columns = createColumns<Issue>()
const issueColumns = columns.columns([
  columns.accessor("title", {
    header: "Issue",
    size: 420,
    cell: ({ row }) => (
      <span className="grid gap-0.5 whitespace-normal">
        <span className="line-clamp-1 font-medium">{row.original.title}</span>
        <span className="truncate font-mono text-xs text-muted-foreground">{row.original.culprit}</span>
      </span>
    ),
  }),
  columns.accessor("level", {
    header: "Level",
    size: 110,
    cell: ({ getValue }) => <Level level={getValue()} label={getValue()} />,
  }),
  columns.accessor("status", {
    header: "Status",
    size: 110,
    cell: ({ getValue }) => (
      <StatusDot tone={getValue() === "resolved" ? "success" : getValue() === "ignored" ? "neutral" : "warning"}>
        {getValue()}
      </StatusDot>
    ),
  }),
  columns.accessor("events", { header: "Events", size: 80, meta: { numeric: true }, cell: ({ getValue }) => formatNumber(getValue()) }),
  columns.accessor("users", { header: "Users", size: 80, meta: { numeric: true }, cell: ({ getValue }) => formatNumber(getValue()) }),
  columns.accessor("last24h", { header: "24h", size: 70, meta: { numeric: true }, cell: ({ getValue }) => formatNumber(getValue()) }),
  columns.accessor("lastSeen", {
    header: "Last seen",
    size: 110,
    sortFn: "datetime",
    cell: ({ getValue }) => (
      <time dateTime={getValue()} title={formatDateTime(getValue())} className="text-muted-foreground">
        {formatTime(getValue())}
      </time>
    ),
  }),
])

const perfColumns = createColumns<(typeof transactions)[number]>()
const transactionColumns = perfColumns.columns([
  perfColumns.accessor("name", { header: "Transaction", meta: { mono: true } }),
  perfColumns.accessor("p50", { header: "p50", meta: { numeric: true }, cell: ({ getValue }) => formatDuration(getValue()) }),
  perfColumns.accessor("p95", { header: "p95", meta: { numeric: true }, cell: ({ getValue }) => formatDuration(getValue()) }),
])

export function TriplineScreen({ session, path, navigate, callbacks, LinkComponent }: ScreenProps) {
  const { segments, query } = parsePath(path)
  const org = segments[1] ?? session.currentOrg ?? "grapevine"
  const project = segments[3] ?? "mobile"
  const env = query.get("env") ?? undefined

  const [issues, setIssues] = React.useState(seedIssues)
  const [status, setStatus] = React.useState("unresolved")
  const [filter, setFilter] = React.useState("")
  const [selection, setSelection] = React.useState<RowSelectionState>({})
  const [panel, setPanel] = React.useState<string | null>(null)
  const [confirm, setConfirm] = React.useState<"delete" | "mute" | null>(null)

  const visible = React.useMemo(
    () =>
      issues.filter(
        (issue) =>
          (status === "all" || issue.status === status) &&
          (!env || issue.env === env) &&
          (!filter || `${issue.title} ${issue.culprit}`.toLowerCase().includes(filter.toLowerCase())),
      ),
    [issues, status, env, filter],
  )
  const unresolved = issues.filter((issue) => issue.status === "unresolved").length
  const selectedIds = Object.keys(selection).filter((id) => selection[id])

  const resolve = useOptimisticAction<Issue[], string[]>({
    state: issues,
    apply: (state, ids) => state.map((issue) => (ids.includes(issue.id) ? { ...issue, status: "resolved" } : issue)),
    commit: async (ids) => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      if (ids.includes("GRAPEVINE-BACKEND-9A1")) throw new Error("GRAPEVINE-BACKEND-9A1 is locked by an open incident.")
      setIssues((prev) => prev.map((issue) => (ids.includes(issue.id) ? { ...issue, status: "resolved" } : issue)))
      setSelection({})
    },
    undo: (ids) => setIssues((prev) => prev.map((issue) => (ids.includes(issue.id) ? { ...issue, status: "unresolved" } : issue))),
    message: (ids) => (ids.length === 1 ? "Issue resolved" : `${ids.length} issues resolved`),
  })

  const contextCommands = React.useMemo<CommandItem[]>(
    () =>
      selectedIds.length > 0
        ? [
            { id: "resolve-selected", label: `Resolve ${selectedIds.length} selected issues`, icon: BugIcon, run: () => void resolve.run(selectedIds) },
            { id: "mute-selected", label: `Mute alerts for ${selectedIds.length} issues`, icon: BellOffIcon, run: () => setConfirm("mute") },
          ]
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedIds.join(","), resolve.run],
  )

  const scope: ScopeConfig = {
    noun: "project",
    items: projects,
    current: project,
    recent: ["backend"],
    href: `/o/${org}/p/${project}/issues`,
    onSelect: (item) => item && navigate(withQuery(`/o/${org}/p/${item.id}/issues`, query)),
    onCreate: () => toast("Create project is a page in the real app"),
  }
  const environment: EnvironmentConfig = {
    options: environments,
    current: env,
    onSelect: (id) => {
      const next = new URLSearchParams(query)
      if (id) next.set("env", id)
      else next.delete("env")
      navigate(withQuery(`/o/${org}/p/${project}/issues`, next))
    },
  }

  const activeIndex = visible.findIndex((issue) => issue.id === panel)
  const active = activeIndex >= 0 ? visible[activeIndex] : undefined

  return (
    <AppShell
      app={{ id: "tripline", name: "tripline" }}
      session={session}
      nav={nav(org, project, unresolved)}
      scope={scope}
      environment={environment}
      registry={{
        placeholder: "Search issues, events, releases…",
        searchGroup: "Issues",
        search: async (q, signal) => {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, 250)
            signal.addEventListener("abort", () => {
              clearTimeout(timer)
              reject(new DOMException("Aborted", "AbortError"))
            })
          })
          return issues
            .filter((issue) => issue.title.toLowerCase().includes(q.toLowerCase()))
            .map((issue) => ({ id: `issue:${issue.id}`, label: issue.title, secondary: issue.id, icon: BugIcon, run: () => setPanel(issue.id) }))
        },
      }}
      callbacks={{ ...callbacks, searchOrgs: searchPlatformOrgs }}
      LinkComponent={LinkComponent}
      currentPath={path}
      onNavigate={navigate}
      seedPins={["issues", "alerts"]}
    >
      <ContextCommands items={contextCommands} />
      <PageActionBar
        breadcrumbs={[{ label: "Issues" }]}
        actions={
          <Button size="sm" disabled={selectedIds.length === 0 || resolve.pending} onClick={() => void resolve.run(selectedIds)}>
            Resolve selected
          </Button>
        }
      />
      <main className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <PageTitle>Issues</PageTitle>
          <span className="text-xs text-muted-foreground tabular-nums">{visible.length} of {issues.length}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger size="sm" aria-label="Status" className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unresolved">Unresolved</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="ignored">Ignored</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter title or culprit"
              aria-label="Filter issues"
              className="h-8 w-56"
            />
          </div>
        </div>

        {resolve.error && (
          <InlineMessage tone="error" title="Could not resolve" onDismiss={resolve.clearError}>
            {resolve.error.message}
          </InlineMessage>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <DataTable
            columns={issueColumns}
            data={visible}
            getRowId={(issue) => issue.id}
            densityKey="tripline/issues"
            defaultDensity="compact"
            selectable
            rowSelection={selection}
            onRowSelectionChange={setSelection}
            activeRowId={panel ?? undefined}
            onRowClick={(issue) => setPanel(issue.id)}
            rowTone={(issue) => (issue.level === "fatal" ? "danger" : undefined)}
            newCount={2}
            onShowNew={() => toast("2 new issues appended")}
            caption="Issues"
            pagination={{
              from: 1,
              to: visible.length,
              total: 142,
              pageSize: 25,
              hasPrevious: false,
              hasNext: true,
              onPrevious: () => {},
              onNext: () => toast("Next page"),
              onPageSize: () => {},
            }}
          />
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <Card size="sm">
                <CardContent>
                  <Metric label="Events (24h)" value={formatNumber(183)} detail="+12% vs prior" />
                </CardContent>
              </Card>
              <Card size="sm">
                <CardContent>
                  <Metric label="Affected users" value={formatNumber(155)} detail="last 24h" />
                </CardContent>
              </Card>
              <Card size="sm">
                <CardContent>
                  <Metric label="Crash-free" value="99.2%" detail="sessions" />
                </CardContent>
              </Card>
            </div>
            <Card size="sm">
              <CardHeader>
                <CardTitle>Performance · last 24h</CardTitle>
                <CardDescription>Slowest transactions in {project}.</CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable columns={transactionColumns} data={transactions} density="compact" hideViewOptions caption="Transactions" />
              </CardContent>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardTitle>Danger zone</CardTitle>
                <CardDescription>Destructive actions confirm at the tier their stakes deserve.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfirm("mute")}>
                  <BellOffIcon strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
                  Mute alerts
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setConfirm("delete")}>
                  <Trash2Icon strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
                  Delete project
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <DetailSheet
        panelId={panel}
        onPanelChange={setPanel}
        title={active?.title ?? "Issue"}
        description={active ? <Id value={active.id} /> : undefined}
        fullPageHref={active ? `/o/${org}/p/${project}/issues/${active.id}` : undefined}
        onPrevious={activeIndex > 0 ? () => setPanel(visible[activeIndex - 1]!.id) : undefined}
        onNext={activeIndex >= 0 && activeIndex < visible.length - 1 ? () => setPanel(visible[activeIndex + 1]!.id) : undefined}
        syncUrl={false}
      >
        {active && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Level</dt>
            <dd>
              <Level level={active.level} label={active.level} />
            </dd>
            <dt className="text-muted-foreground">Culprit</dt>
            <dd className="font-mono text-xs">{active.culprit}</dd>
            <dt className="text-muted-foreground">Release</dt>
            <dd>
              <Id value={active.release} />
            </dd>
            <dt className="text-muted-foreground">Environment</dt>
            <dd>{active.env}</dd>
            <dt className="text-muted-foreground">First seen</dt>
            <dd>{formatDateTime(active.firstSeen)}</dd>
            <dt className="text-muted-foreground">Last seen</dt>
            <dd>{formatDateTime(active.lastSeen)}</dd>
          </dl>
        )}
      </DetailSheet>

      <ConfirmDialog
        open={confirm === "mute"}
        onOpenChange={(open) => !open && setConfirm(null)}
        tier={2}
        title="Mute alerts?"
        description="Alerts for the selected issues stop until you unmute them."
        confirmLabel="Mute alerts"
        destructive={false}
        onConfirm={async () => {
          await new Promise((resolve) => setTimeout(resolve, 300))
          toast("Alerts muted")
        }}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(open) => !open && setConfirm(null)}
        tier={3}
        title={`Delete project ${project}?`}
        description="All issues, events and releases in this project are removed. This cannot be undone."
        confirmLabel="Delete project"
        resourceName={project}
        onConfirm={async () => {
          await new Promise((_, reject) => setTimeout(() => reject(new Error("Projects with open incidents cannot be deleted.")), 400))
        }}
      />
    </AppShell>
  )
}

function ContextCommands({ items }: { items: CommandItem[] }) {
  useCommands(items)
  return null
}
