# Adopt in runsheet's portal

Repo: `/home/chris/workspace/runsheet/portal` (its own git repo, remote
runsheet/portal; Vite 7 + React 19 + Tailwind v4 + TanStack Router
file-based routes; ~300 lines; `src/auth` holds the latchkey auth
context; `_authed.tsx` is a placeholder layout with Home/About/Profile/
Settings links).

- Replace the `_authed` layout with the shell: sidebar, action bar,
  switcher. Orgs from the latchkey token's `ns` claim (`runsheet/<team>`
  or bare slugs — inspect `src/auth` and the claims; treat top-level
  namespaces as orgs and `<org>/<x>` as teams for the scope crumb).
- Routes: `/o/$org` (home), `/o/$org/runbooks`, `/o/$org/runs`,
  `/o/$org/incidents`, `/o/$org/settings`, plus `/welcome` and
  `/invitations/$id`. Runbooks/Runs/Incidents can be honest empty states
  (`EmptyState` blank-slate) since the product has no data yet; keep the
  existing About/Profile/Settings content reachable (Profile → account
  menu, Settings → `/o/$org/settings`).
- Sidebar groups: Pinned; Operate — Runbooks, Runs, Incidents; Settings.
  Team/service is the scope crumb (picker from the ns claim).
- Use `@latchkey/shell/theme/runsheet.css`. Remove the gray utility
  classes from `styles.css` in favour of the tokens.
- TanStack Router: pass its `Link` as the shell's LinkComponent and
  `router.navigate` as `onNavigate`; regenerate `routeTree.gen.ts`.
