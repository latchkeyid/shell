# Adopt in the latchkey console

Repo: `/home/chris/workspace/latchkey/ui` (npm workspaces; the app is
`console/`: Vite 5 + React 18 + react-router-dom 6, ~5,600 lines, own
`ui.tsx` components, `styles.css`, `auth.ts` with `isAdmin()` and
`claims()`, `api.ts`). The shell needs React 19: upgrade `console` to
React 19 + react-router-dom 7 (library mode) + Vite 6/7 and fix what
breaks. Deploys to Cloudflare Pages via wrangler from this repo.

- Orgs: `GET /oauth/my-businesses` gives `{businesses:[{slug,
  display_name}]}`; roles per org from the token's `ns` claim (bare
  slug → org level). `isAdmin()` (ns has `latchkey` or `*`) → `staff`.
- Routes today: `/` Home, `/admin` (Orgs directory), `/admin/clients`,
  `/admin/users`, `/admin/sessions`, `/admin/logins`,
  `/admin/attempts`, `/admin/members`, `/:slug` (Org), `/:slug/tenants`,
  `/:slug/tenants/:tenant(/:tab)`, `/:slug/users(/:id)`,
  `/:slug/members`, `/:slug/sessions`, `/:slug/logins`,
  `/:slug/settings(/:section)`. Move org pages under `/o/:slug/…` with
  redirects from the old paths; `/admin/*` stays as the platform area
  (the Platform group's "All organisations…" → `/admin`).
- Sidebar groups (org scope): Pinned; Directory — Users, Sessions,
  Logins, Members; Tenancy — Tenants; Settings — the settings sections
  as tabs on the settings page (not nav items). Staff additionally get a
  Platform group: Organisations (/admin), Clients, Identities, Sessions,
  Logins, Attempts, Members. Keep counts where the API already returns
  them cheaply; otherwise none.
- The tenant is the scope crumb on tenant pages (`/o/:slug/tenants/:t`),
  "all tenants" otherwise; picker lists the org's tenants.
- Staff view-as chrome: when `staff` and the current org is not in the
  user's own memberships, set `actAs: { org }` (no reason/expiry yet;
  the server-side time-boxed elevation is a later latchkey feature) so
  the amber chrome and "Exit staff view" (→ `/admin`) appear.
- The Welcome page (zero orgs → create org) becomes `/welcome` on the
  shell's EmptyState; keep the claim-business flow and the refresh.
- Migrate `ui.tsx` primitives to shell components page by page; tables
  (users, sessions, logins, clients, members, tenants) to `DataTable`
  with `StatusDot` for active/revoked/pending. Where a page is large,
  it is acceptable to wrap it in the shell first and convert its
  internals after, but no page may regress.
- Delete `styles.css` and `ui.tsx` only when nothing imports them.
