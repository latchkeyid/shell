import * as React from "react"
import {
  AppWindowIcon,
  Building2Icon,
  ClockIcon,
  CreditCardIcon,
  FileKeyIcon,
  FingerprintIcon,
  GlobeIcon,
  IdCardIcon,
  KeyRoundIcon,
  LayersIcon,
  LockKeyholeIcon,
  MailIcon,
  MoreHorizontalIcon,
  PaletteIcon,
  PlugIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ShieldIcon,
  UserCheckIcon,
  WebhookIcon,
} from "lucide-react"

import { ConfirmDialog } from "@/actions/confirm-dialog"
import { toast } from "@/actions/toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable, createColumns } from "@/data/data-table"
import { DetailSheet } from "@/data/detail-sheet"
import { EmptyState } from "@/data/empty-state"
import { formatDate, formatDateTime, formatTime } from "@/data/formatters"
import { Id } from "@/data/id"
import { StatusDot } from "@/data/status-dot"
import { AppShell } from "@/shell/app-shell"
import { PageActionBar, PageTitle } from "@/shell/page-action-bar"
import type { NavGroup, ScopeConfig } from "@/shell/types"

import { identities, type Identity } from "../fixtures/data"
import { searchPlatformOrgs } from "../fixtures/sessions"
import { parsePath, type ScreenProps } from "./types"

const tenants = [
  { id: "northcote-cafe", label: "Northcote Cafe", secondary: "northcote-cafe", tag: "Prod" },
  { id: "bayside-pm", label: "Bayside PM", secondary: "bayside-pm", tag: "Prod" },
  { id: "acme", label: "Acme Staging", secondary: "acme", tag: "Staging" },
]

function nav(org: string, tenant: string): NavGroup[] {
  const t = `/o/${org}/tenants/${tenant}`
  const o = `/o/${org}`
  return [
    {
      id: "directory",
      label: "Directory",
      items: [
        { id: "identities", label: "Identities", href: `${t}/identities`, icon: IdCardIcon, count: 142 },
        { id: "sessions", label: "Sessions", href: `${t}/sessions`, icon: ClockIcon, count: 38 },
        { id: "invitations", label: "Invitations", href: `${t}/invitations`, icon: MailIcon, count: 2 },
      ],
    },
    {
      id: "access",
      label: "Access",
      items: [
        { id: "clients", label: "Clients", href: `${t}/clients`, icon: AppWindowIcon },
        { id: "grants", label: "Grants", href: `${t}/grants`, icon: UserCheckIcon },
        { id: "scopes", label: "Scopes", href: `${t}/scopes`, icon: KeyRoundIcon },
      ],
    },
    {
      id: "tenancy",
      label: "Tenancy",
      items: [
        { id: "tenants", label: "Tenants", href: `${o}/tenants`, icon: LayersIcon, exact: true },
        { id: "organisations", label: "Organisations", href: `${o}/organisations`, icon: Building2Icon },
      ],
    },
    {
      id: "security",
      label: "Security",
      items: [
        { id: "policies", label: "Policies", href: `${o}/security/policies`, icon: ShieldCheckIcon },
        { id: "audit", label: "Audit log", href: `${o}/security/audit`, icon: ScrollTextIcon },
        { id: "keys", label: "Signing keys", href: `${o}/security/keys`, icon: FileKeyIcon },
        { id: "mfa", label: "MFA", href: `${o}/security/mfa`, icon: FingerprintIcon },
      ],
    },
    {
      id: "integrations",
      label: "Integrations",
      items: [
        { id: "webhooks", label: "Webhooks", href: `${o}/integrations/webhooks`, icon: WebhookIcon },
        { id: "saml", label: "SAML", href: `${o}/integrations/saml`, icon: ShieldIcon },
        { id: "scim", label: "SCIM", href: `${o}/integrations/scim`, icon: PlugIcon },
      ],
    },
    {
      id: "settings",
      label: "Settings",
      items: [
        { id: "general", label: "General", href: `${o}/settings`, icon: SettingsIcon, exact: true },
        { id: "branding", label: "Branding", href: `${o}/settings/branding`, icon: PaletteIcon },
        { id: "domains", label: "Domains", href: `${o}/settings/domains`, icon: GlobeIcon },
        { id: "billing", label: "Billing", href: `${o}/billing`, icon: CreditCardIcon },
        { id: "api-keys", label: "API keys", href: `${o}/settings/api-keys`, icon: LockKeyholeIcon },
      ],
    },
  ]
}

const statusTone = { active: "success", suspended: "danger", pending: "warning" } as const

export function LatchkeyScreen({ session, path, navigate, callbacks, LinkComponent }: ScreenProps) {
  const { segments } = parsePath(path)
  const org = segments[1] ?? session.actAs?.org ?? session.currentOrg ?? "latchkey"
  const tenant = segments[3] ?? "all"
  const [tab, setTab] = React.useState("all")
  const [panel, setPanel] = React.useState<string | null>(null)
  const [revoke, setRevoke] = React.useState<Identity | null>(null)
  const [suspend, setSuspend] = React.useState<Identity | null>(null)
  const readOnly = Boolean(session.actAs)

  const columns = React.useMemo(() => {
    const helper = createColumns<Identity>()
    return helper.columns([
      helper.accessor("email", {
        header: "Email",
        size: 240,
        cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
      }),
      helper.accessor("name", { header: "Name", size: 150 }),
      helper.accessor("tenant", {
        header: "Tenant",
        size: 140,
        cell: ({ getValue }) => <Badge variant="outline">{getValue()}</Badge>,
      }),
      helper.accessor("status", {
        header: "Status",
        size: 110,
        cell: ({ getValue }) => <StatusDot tone={statusTone[getValue()]}>{getValue()}</StatusDot>,
      }),
      helper.accessor("mfa", { header: "MFA", size: 90, cell: ({ getValue }) => (getValue() === "none" ? null : getValue()) }),
      helper.accessor("sessions", { header: "Sessions", size: 90, meta: { numeric: true } }),
      helper.accessor("grants", { header: "Grants", size: 80, meta: { numeric: true } }),
      helper.accessor("source", { header: "Source", size: 90 }),
      helper.accessor("lastSignIn", {
        header: "Last sign-in",
        size: 120,
        sortFn: "datetime",
        cell: ({ getValue }) => {
          const value = getValue()
          return value ? (
            <time dateTime={value} title={formatDateTime(value)} className="text-muted-foreground">
              {formatTime(value)}
            </time>
          ) : null
        },
      }),
      helper.accessor("created", { header: "Created", size: 110, sortFn: "datetime", cell: ({ getValue }) => formatDate(getValue()) }),
      helper.accessor("id", { header: "ID", size: 170, enableSorting: false, cell: ({ getValue }) => <Id value={getValue()} truncate /> }),
      helper.display({
        id: "actions",
        size: 48,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Actions for ${row.original.email}`}
                onClick={(event) => event.stopPropagation()}
                className="text-muted-foreground"
              >
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
              <DropdownMenuItem onSelect={() => setPanel(row.original.id)}>View details</DropdownMenuItem>
              <DropdownMenuItem disabled={readOnly} onSelect={() => toast("Password reset email sent")}>
                Send password reset
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={readOnly} variant="destructive" onSelect={() => setRevoke(row.original)}>
                Revoke sessions
              </DropdownMenuItem>
              <DropdownMenuItem disabled={readOnly} variant="destructive" onSelect={() => setSuspend(row.original)}>
                Suspend identity
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      }),
    ])
  }, [readOnly])

  const rows = React.useMemo(
    () =>
      identities.filter(
        (identity) => (tenant === "all" || identity.tenant === tenant) && (tab === "all" || identity.status === tab),
      ),
    [tenant, tab],
  )
  const activeIndex = rows.findIndex((identity) => identity.id === panel)
  const active = activeIndex >= 0 ? rows[activeIndex] : undefined

  const scope: ScopeConfig = {
    noun: "tenant",
    items: tenants,
    current: tenant === "all" ? undefined : tenant,
    allLabel: "all tenants",
    href: `/o/${org}/tenants/${tenant}/identities`,
    onSelect: (item) => navigate(`/o/${org}/tenants/${item?.id ?? "all"}/identities`),
    onCreate: readOnly ? undefined : () => toast("Create tenant is a page in the real app"),
  }

  return (
    <AppShell
      app={{ id: "latchkey", name: "latchkey" }}
      session={session}
      nav={nav(org, tenant)}
      scope={scope}
      registry={{
        placeholder: "Search email, session, client…",
        searchGroup: "Identities",
        search: async (q) =>
          identities
            .filter((identity) => identity.email.includes(q.toLowerCase()) || identity.name.toLowerCase().includes(q.toLowerCase()))
            .map((identity) => ({ id: `identity:${identity.id}`, label: identity.email, secondary: identity.name, icon: IdCardIcon, run: () => setPanel(identity.id) })),
      }}
      callbacks={{ ...callbacks, searchOrgs: searchPlatformOrgs }}
      LinkComponent={LinkComponent}
      currentPath={path}
      onNavigate={navigate}
      seedPins={["identities", "audit"]}
      defaultTheme="light"
    >
      <PageActionBar
        breadcrumbs={[{ label: "Identities" }]}
        searchPlaceholder="Search email, session, client…"
        tabs={
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList variant="line" className="h-8">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="suspended">Suspended</TabsTrigger>
            </TabsList>
          </Tabs>
        }
        actions={
          <Button size="sm" disabled={readOnly} title={readOnly ? "Read-only in staff view — elevate to change" : undefined}>
            Invite identity
          </Button>
        }
      />
      <main className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-2">
          <PageTitle>Identities</PageTitle>
          <span className="text-xs text-muted-foreground tabular-nums">{rows.length} shown</span>
        </div>
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(identity) => identity.id}
          densityKey="latchkey/identities"
          defaultDensity="normal"
          pinFirstColumn
          pinLastColumn
          activeRowId={panel ?? undefined}
          onRowClick={(identity) => setPanel(identity.id)}
          caption="Identities"
          maxHeight="calc(100svh - 14rem)"
          emptyState={<EmptyState variant="no-results" size="sm" title="No identities match" description="Change the tenant or the status tab." />}
          pagination={{
            from: 1,
            to: rows.length,
            total: 142,
            pageSize: 50,
            hasPrevious: false,
            hasNext: true,
            onPrevious: () => {},
            onNext: () => toast("Next page"),
            onPageSize: () => {},
          }}
        />
      </main>

      <DetailSheet
        panelId={panel}
        onPanelChange={setPanel}
        title={active?.email ?? "Identity"}
        description={active ? <Id value={active.id} /> : undefined}
        fullPageHref={active ? `/o/${org}/tenants/${active.tenant}/identities/${active.id}` : undefined}
        onPrevious={activeIndex > 0 ? () => setPanel(rows[activeIndex - 1]!.id) : undefined}
        onNext={activeIndex >= 0 && activeIndex < rows.length - 1 ? () => setPanel(rows[activeIndex + 1]!.id) : undefined}
        syncUrl={false}
      >
        {active && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{active.name}</dd>
            <dt className="text-muted-foreground">Tenant</dt>
            <dd>
              <Badge variant="outline">{active.tenant}</Badge>
            </dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <StatusDot tone={statusTone[active.status]}>{active.status}</StatusDot>
            </dd>
            <dt className="text-muted-foreground">MFA</dt>
            <dd>{active.mfa}</dd>
            <dt className="text-muted-foreground">Created</dt>
            <dd>{formatDateTime(active.created)}</dd>
          </dl>
        )}
      </DetailSheet>

      <ConfirmDialog
        open={revoke != null}
        onOpenChange={(open) => !open && setRevoke(null)}
        tier={2}
        title={`Revoke sessions for ${revoke?.email}?`}
        description="Every active session is signed out immediately. The identity can sign in again."
        confirmLabel="Revoke sessions"
        onConfirm={async () => {
          await new Promise((resolve) => setTimeout(resolve, 300))
          toast(`Revoked ${revoke?.sessions ?? 0} sessions`)
        }}
      />
      <ConfirmDialog
        open={suspend != null}
        onOpenChange={(open) => !open && setSuspend(null)}
        tier={3}
        title={`Suspend ${suspend?.email}?`}
        description="The identity cannot sign in and every grant is paused until an admin reinstates it."
        confirmLabel="Suspend identity"
        resourceName={suspend?.email}
        onConfirm={async () => {
          await new Promise((resolve) => setTimeout(resolve, 300))
          toast("Identity suspended")
        }}
      />
    </AppShell>
  )
}
