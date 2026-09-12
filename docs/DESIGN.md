# @latchkey/shell — design brief

One theme and one app shell for three consoles that all sign in through
latchkey: **tripline** (error/performance tracker), **runsheet**
(runbooks/ops) and the **latchkey console** (identity provider admin).
Each app differs only in its accent colour and the nav groups it passes
in. This brief is the contract; `docs/research/` holds the evidence
(`trends.json`: 13 verified design decisions; `switcher.json`: the org
switcher spec; `console-themes.html`: the approved mockups — open it in
a browser, Option B "dressed" and the switcher section are the target).

## Stack

React 19, TypeScript, Tailwind v4, shadcn/ui (new-york style, `radix`
primitives via the shadcn CLI), lucide-react, cmdk (via shadcn Command),
sonner (via shadcn Sonner), @tanstack/react-table v8+ for DataTable.
Router-agnostic: every link is rendered through a `LinkComponent` the
app supplies (react-router `Link` in tripline/latchkey, TanStack `Link`
in runsheet), and navigation is a callback (`onNavigate(href)`).
Consumed as a git dependency (`"@latchkey/shell": "github:latchkeyid/shell"`),
shipping TypeScript source: `exports` point at `src/`, consumers run
Vite + TS `moduleResolution: "bundler"` and add
`@source "../node_modules/@latchkey/shell/src";` to their Tailwind CSS.

## Tokens (`src/theme/base.css` + one accent file per app)

shadcn's semantic contract is the only public API (`--background`,
`--foreground`, `--card`, `--popover`, `--primary`, `--secondary`,
`--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`,
`--sidebar*`, `--chart-1..5`, `--radius`), authored in OKLCH, generated
from a 12-step scale layer. Plus status scales the contract lacks:
`--success`, `--warning`, `--info`, each with `-foreground`, `-muted`,
`-border`. Components reference semantic tokens only.

- **Neutral, shared by all apps: mauve-tinted** (chroma ≈ 0.008, hue ≈
  300). Light: background `#F5F4F7`, card/panel `#FBFAFC`, foreground
  `#1F1D22`, muted-foreground `#6B6771`, border `#E2DFE7`. Dark (a
  separately tuned scale, not an inversion): background `#171519`,
  card `#1E1B22`, foreground `#E8E5EC`, muted-foreground `#9B97A3`,
  border `#2F2B36`; elevation by lighter surfaces (card +1 step, popover
  +2), shadows only on floating layers, hairline alpha borders
  (`black/8%` light, `white/10%` dark), `--row-hover` (`black/4%` /
  `white/6%`), `--row-selected` (accent 8% / 12%).
- **Status** (fixed hues, never reused as accent): danger light
  `#B42318` / dark `#F0776C`; warning `#A15C00` / `#E2A23B`; success
  `#1F7A4D` / `#5CC28C`; info blue. Staff/impersonation chrome is amber
  `#D97706` and is reserved for that.
- **Accent, the only per-app variable** (`theme/tripline.css`,
  `theme/runsheet.css`, `theme/latchkey.css`), each with a second stop
  for gradients (`--accent-2`) and a soft tint (`--accent-soft`):
  tripline indigo `#5B5BD6` (dark `#7C7CE8`), accent-2 `#8E4EC6` /
  `#B07CE8`, soft `#EEEEFB` / `#26244A`; runsheet teal `#12A594` /
  `#3FC29B`, accent-2 `#2FB36B` / `#5FD08A`, soft `#E0F5F0` / `#163A31`;
  latchkey violet `#6E56CF` / `#9B8AE6`, accent-2 `#B14AB8` / `#D37BE0`,
  soft `#F1EEFB` / `#2B2450`. Map the accent onto `--primary`,
  `--ring`, `--sidebar-primary`, `--sidebar-accent`.
- **Type**: Geist Sans + Geist Mono (the `geist` npm package,
  self-hosted); scale 12/13/14/16 rem-based with 13px app body and table
  rows, 12px labels/metadata/badges, 14px inputs (16px on touch), 16px
  page titles, a `Metric` style (24–32px, tabular-nums, medium);
  `tabular-nums` on every numeric column; mono (12.5px, slashed zero,
  ligatures off) for identifiers via an `<Id>` component. Line-height
  1.25 single-line, 1.5 multi-line.
- **Radius**: `--radius: 0.375rem`; 6px controls/badges/inputs, 8px
  cards/popovers, 12px menus/dialogs; nav items and table rows ≤ 6px.
  Controls h-8 (32px). Focus ring 3px `--ring`.
- **Icons**: lucide, 16px, strokeWidth 1.5, `absoluteStrokeWidth`;
  12px chevrons; aria-label on every icon-only button.
- **The dressed finish** (this IS the look, on the same tokens): a faint
  accent wash at the top of the sidebar
  (`linear-gradient(180deg, color-mix(in srgb, var(--primary) 7%, var(--sidebar)) 0, var(--sidebar) 120px)`),
  the org avatar and primary button as a two-stop gradient
  (`135deg, --primary → --accent-2`) with an inset top highlight, a
  glassy page action bar (`bg/78% + backdrop-blur(10px)`), cards with a
  soft two-layer shadow in light and an inset 1px white/4% highlight in
  dark, the active nav item with `inset 2px 0 0 --primary` plus a
  1px accent ring (light) or an 18px soft glow (dark), selected table
  rows with a horizontal accent-soft gradient, status dots with a 3px
  18%-alpha halo. Respect `prefers-reduced-motion`.
- Three theme states: bare `:root` is light, `.dark` is dark (shadcn's
  remap), `color-scheme` set on `<html>`, and a `ThemeProvider` that
  follows system by default with an explicit override persisted in
  localStorage. tripline and runsheet default to system; latchkey
  defaults to light.

## The shell (`<AppShell>`)

Layout: a `SidebarProvider` (shadcn Sidebar, `collapsible="icon"`,
`variant="inset"`) with a 240px sidebar / 48px icon rail, toggled by
Cmd/Ctrl+B and the rail edge, state persisted in a cookie
(`sidebar_state`) so first paint matches, `SidebarMenuSkeleton` while
nav data loads. The sidebar is one step dimmer than the content pane in
both themes. Below 768px the sidebar is a Sheet.

Sidebar contents, top to bottom:
1. `SidebarHeader`: the app wordmark (small, muted) and the
   **OrgSwitcher** trigger (below).
2. `Pinned` group: per-user pinned nav items (star/unstar via
   `SidebarMenuAction`), seeded by the app, persisted per user+app in
   localStorage (`shell.pins.<app>.<userId>`), plus up to 5 Recent.
3. 3–6 task-oriented groups with non-interactive `SidebarGroupLabel`
   headers (11px uppercase tracking-wide muted, 16px gap between groups)
   and 28px `SidebarMenuButton size="sm"` rows (13px, lucide 16px icon,
   optional trailing count in mono 11px). **Two levels only**, no
   accordions; entity sub-pages are Tabs in the action bar.
4. `SidebarFooter`: a muted "⌘B" hint; NO account menu here.

The **PageActionBar** is sticky (`h-12`, 48px) at the top of the content
pane, glassy, with four slots: `SidebarTrigger` + vertical Separator;
the **scope chain** (below); a Tabs slot the page fills for entity
sub-views; and a right-aligned actions slot that always ends with a
visible ⌘K chip (`h-8 w-56`, "Search or jump to…", `kbd ⌘K`) and the
**account menu** (avatar, name/email, theme toggle, Invitations,
Sign out).

## OrgSwitcher (from `docs/research/switcher.json` → `judged.spec`)

Trigger (expanded): `SidebarMenuButton size="lg"` (h-12): 32px avatar
(logo else two-letter initials on a gradient), two truncated lines (org
name 13px medium; role for THIS org 12px muted: Owner/Admin/Member/
Viewer), `ChevronsUpDown` 16px only when there is something to switch to
(other orgs, invitations, create, or staff). Pending-invitation count as
a 16px badge on the avatar corner. Staff view-as: amber ring
(`ring-2 ring-amber-500`) and second line "Staff view · 52 min left".
Rail (48px): the 32px avatar is the whole trigger; badge shrinks to an
8px dot; tooltip on the right "grapevine · Owner  G O"; aria-label
carries name, role and invite count. The org name is repeated as the
first crumb in the action bar so it stays visible in the rail.

Popover (never DropdownMenu): shadcn `Popover` + `Command`, 288px, p-0,
`max-h-[70vh]`, `role=dialog aria-label="Switch organisation"`,
side=bottom from the header, side=right from the rail, opened by
Enter/Space/ArrowDown and the global chord **G then O** (750ms window,
ignored inside inputs/editors/open dialogs). Sections top to bottom:
1. Header row (56px, non-interactive): avatar, org name, role Badge,
   trailing Check; Settings icon button for owner/admin.
2. CommandInput (36px, always rendered, autofocused): "Find
   organisation…", trailing `CommandShortcut` "G O"; combobox semantics
   (`aria-activedescendant` listbox); current org initially highlighted.
3. Invitations (n) — only when n > 0, first group: 42px rows, 20px
   avatar, org name, "Invited by jane@… as Admin", trailing ArrowRight;
   each row navigates to `/invitations/:id` (Accept/Decline live there).
4. Recent — only when memberships > 8: last 3 visited.
5. Your organisations (heading shows the count): current org pinned
   first with Check + `aria-selected`, rest alphabetical; 36px rows,
   20px avatar, name, role right-aligned 12px muted; suspended orgs
   `aria-disabled` with a status tip.
6. Platform — staff only: "All organisations…" → the app's directory
   page; while the query is ≥ 2 chars, server results for non-member
   orgs with an Eye icon, slug as secondary text and "Not a member".
7. Separator, then actions: "Exit staff view" first while acting;
   "Create organisation" (Plus) when the session allows it → a page.
8. States: `CommandEmpty` "No organisations match “q”"; a selectable
   "Couldn't load organisations — Retry" row; 3 skeleton rows after 1s.

Selection: call the app's `onSwitch(org)`; the app rewrites the path in
place for org-scoped routes and lands on the org home otherwise, clears
per-org caches, announces once via a shell-owned `aria-live=polite`
region ("Switched to Globex") and moves focus to the page h1. Trigger
gets `aria-busy` + spinner during the switch.

Edge cases: zero orgs → the app renders a full-page `/welcome`
(invitations as cards with real Accept/Decline, Create if allowed, else
"Ask an admin to invite you with <email>" + copy); one org → identity
only (no chevron, no chord hint) unless invitations/create/staff apply;
50+ orgs → "Type to search N organisations" hint, virtualised rows
above 100; long names truncate with `title`.

Staff view-as (chrome only in the shell; the elevation flow is the
app's): `actAs: { org, reason?, expiresAt? }` on the session paints
`data-staff-view` on `<html>`, an amber ring on the trigger, a 2px amber
inset on the content frame, and a 28px amber banner above the action bar
("Viewing <org> as platform staff · reason … · expires in 52 min · Exit
staff view").

Scope chain (in the action bar, left of page breadcrumbs, 32px): crumb 1
= org avatar + name as a muted Link to the org home; then the container
sub-scope as a switchable crumb (chip with chevron, opens a `Command`
picker with search/recents): tripline **project**, runsheet **team or
service**, latchkey **tenant** (or "all tenants"); tripline adds an
**environment** chip after a 1px divider (query param `?env=`, default
all; production carries a warning-tone dot on the chip only). Chords:
**G then P** opens the sub-scope picker, **G then E** the environment.

URL scheme every app follows: `/o/:orgSlug/…`; `/o/~/…` resolves
last-visited → default → first membership; a URL for an org you are not
in renders a 403 page with the switcher still mounted (staff see "View
as staff"). tripline `/o/:org/p/:project/issues?env=…`; runsheet
`/o/:org/t/:team/runbooks`; latchkey `/o/:org/tenants/:tenant/users`,
`/o/:org/settings`, `/o/:org/members`. Cross-org: `/welcome`,
`/invitations/:id`, `/orgs/new`. (Apps may keep legacy paths with
redirects.)

## Session model the shell consumes

```ts
type ShellSession = {
  user: { id: string; email: string; name?: string; avatarUrl?: string }
  orgs: Array<{ slug: string; name: string; role: 'owner'|'admin'|'member'|'viewer'; avatarUrl?: string; suspended?: boolean }>
  currentOrg?: string
  invitations: Array<{ id: string; orgSlug: string; orgName: string; invitedBy: string; role: string }>
  canCreateOrg: boolean
  staff: boolean                       // platform staff: sees the Platform group
  actAs?: { org: string; reason?: string; expiresAt?: string }
  recentOrgs?: string[]
}
```
Plus `searchOrgs?(q) => Promise<{slug,name}[]>` for the Platform group,
`onSwitch(slug)`, `onExitStaffView()`, `onCreateOrg()`, `onSignOut()`,
`onTheme(mode)`.

## Command palette

`<CommandPalette registry={...}>`: shadcn `CommandDialog` on ⌘/Ctrl+K,
fed by a per-app registry with three sources: static pages for every
nav item (works day one), async entity search (`search(q) =>
Promise<Item[]>`, debounced 250ms, stale results aborted), and
context actions the current page registers (`useCommands(items)`).
Entries "Switch organisation…" / "Switch project…" open the same pickers
with the typed query carried over. Backspace pops nested pages; pasting
an internal URL jumps to it. Verb-phrase labels; grouping past ~30
items.

## Data components

- `DataTable` on TanStack Table under shadcn `Table`: `data-density=
  "compact|normal|spacious"` on the root sets `--cell-py 4/8/12px` and
  `--cell-px 8/12/16px` (28/36/44px rows at 13px), chosen from a view
  options menu and persisted per route in localStorage; sticky header
  inside the table's own overflow container; optional pinned first
  column (identifier) and last column (row actions); numeric columns
  `text-right tabular-nums`; empty cells render `—`; times relative
  within 7 days then absolute via shared `formatters`. Cursor paging
  copy: "21–40 of 142", Previous / Next, page-size selector. Live
  streams append behind an "N new" pill.
- `ListRow`: whole-row clickable, primary text + inline 12px muted
  metadata + status glyph + trailing hover actions (tripline issue
  stream, runsheet run history).
- `StatusDot` (6px dot + text, never colour-only), `Level` (16px icon +
  text for error/warning/info), `Badge` only for tags/environments,
  `Id` (mono, copy on click), `EmptyState` with variants
  `no-results | blank-slate | cleared | permission | error`.
- `DetailSheet`: shadcn Sheet `side="right"`, resizable 400–720px with
  the width remembered, route-synced via `?panel=<id>`, ↑/↓ or j/k
  between rows, "Open full page" escape hatch. Never for create/edit
  forms or destructive confirmations.
- Mutation contract: `useOptimisticAction` (React 19 `useOptimistic`)
  with an 8s Undo toast for reversible actions; `ConfirmDialog` tier 2
  (focus on Cancel, verb+noun destructive primary, Enter never confirms)
  and tier 3 (typed resource name). Toasts (sonner, aria-live polite)
  for acknowledgments only; failures render inline (`InlineMessage`).
  Declarative forms use explicit Save; imperative controls autosave with
  an inline "Saved".

## Deliverables

- `src/theme/{base,tripline,runsheet,latchkey}.css`, `src/index.ts`
  exporting everything, `src/components/ui/*` (shadcn), `src/shell/*`
  (AppShell, Sidebar nav, OrgSwitcher, PageActionBar, ScopeChain,
  AccountMenu, CommandPalette, ThemeProvider, hotkeys), `src/data/*`
  (DataTable, ListRow, StatusDot, Level, Id, EmptyState, DetailSheet,
  formatters), `src/actions/*` (ConfirmDialog, useOptimisticAction,
  toast helpers, InlineMessage).
- `playground/`: a Vite app rendering a tripline-like screen, a
  latchkey-like screen (20 nav sections) and a runsheet-like screen with
  an app switcher and light/dark toggle, using fixture sessions
  (multi-org, single-org, zero-org, staff view-as, 60 orgs).
- Vitest unit tests for hotkeys (chords, input guards), the switcher's
  filtering/sections, formatters and density; a Playwright smoke that
  opens the playground and screenshots the three screens in both
  themes into `docs/screenshots/`.
- `README.md`: install (git dep), the Tailwind `@source` line, the
  session model, the URL scheme, and how an app supplies groups, the
  scope chain and its command registry.
