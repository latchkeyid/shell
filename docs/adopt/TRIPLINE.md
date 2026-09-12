# Adopt in tripline's console

Repo: `/home/chris/workspace/tripline`, app in `console/` (Vite + React
19 + react-router-dom 7, hand-written CSS in `src/styles.css`, PKCE auth
in `src/auth.ts`, API client `src/api.ts`, pages in `src/pages/`). Git
identity is configured per-repo; credentials helper already set. The
Go backend embeds `console/dist` (see `console/embed.go` and the
`Dockerfile` node stage — that stage runs `npm ci` in `console/` on
`node:22-alpine`, so a git dependency will need `apk add --no-cache git`
there; add it).

- Tenants are the orgs: `/v1/me` returns `orgs: [{slug, level}]`,
  `staff`, `email`, `sub`; `/config.json` returns `signup` (→
  `canCreateOrg`). There is no tenant display name in tripline yet;
  use the slug.
- Current routes: `/o/:org` (projects), `/o/:org/new`, `/o/:org/team`,
  `/o/:org/p/:project` (issues), `/settings`, `/performance`,
  `/performance/t`, `/performance/t/:txn`, `/issues/:issue`. Keep them.
  Project is the scope crumb (picker lists `/v1/orgs/:org/projects`);
  add the environment chip (`?env=`) and wire it to the `environment`
  filter on issues and performance.
- Sidebar groups: Pinned; Monitor — Issues, Performance, Alerts
  (→ project settings' rules section); Organisation — Projects, Team;
  Settings — Project settings. Only real pages; no placeholders.
- Signup (`Welcome.tsx`) becomes the shell's zero-org `/welcome` with the
  existing create flow (it already polls until the token carries the
  tenant — keep that). Invitations page as in COMMON.md.
- Staff (`me.staff`): Platform group's "All organisations…" can open a
  simple page listing nothing yet — instead make the search box accept
  any slug and switch to it (the existing behaviour), labelled "Open
  tenant <slug> as staff".
- Tables: issues → `ListRow` list (compact density), performance
  summaries → `DataTable` with tabular numerics, rules/notifications →
  `DataTable`. Issue detail keeps its layout on the tokens.
- Delete `styles.css` when done. Update `README.md`'s console notes.
