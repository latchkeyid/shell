# Adopting @latchkey/shell — common rules

- Read `docs/DESIGN.md` and the package `README.md` first. The package
  lives at `/home/chris/workspace/shell`; during adoption install it as
  a local dependency (`"@latchkey/shell": "file:../../shell"` or the
  right relative path) so fixes can be made in both places; the final
  commit switches to `"github:latchkeyid/shell#<sha>"` (I will push the
  shell and give you the sha; leave a TODO comment on the dependency
  line if it is not yet available).
- Tailwind v4 via `@tailwindcss/vite`; the app's CSS is
  `@import "tailwindcss"; @import "@latchkey/shell/theme/base.css";
  @import "@latchkey/shell/theme/<app>.css"; @source "../node_modules/@latchkey/shell/src";`
  Delete the app's old hand-written styles once nothing references them.
- The shell is router-agnostic: pass the app's `Link` and an
  `onNavigate`. Keep the app's router.
- URL scheme: `/o/:orgSlug/…` for everything org-scoped; keep old paths
  working with redirects. `/welcome` (zero orgs), `/invitations/:id`,
  and the org home `/o/:org` must exist.
- Session model: build a `ShellSession` from the app's existing auth
  (latchkey access token `ns` claim + the app's own me/session call).
  Roles map from latchkey levels: owner→owner, admin→admin,
  member→member, viewer→viewer. Invitations come from latchkey
  `GET /oauth/invitations/mine` with the user's own bearer (it is
  CORS-open on `/oauth/*`); accepting is
  `POST /oauth/invitations/{id}/accept {"generation": N}` — build the
  `/invitations/:id` page on that. Display names for orgs come from the
  app's own data where it has it, else the slug.
- Every page keeps its functionality. Move tables onto `DataTable` /
  `ListRow` and status onto `StatusDot`/`Level`; move the old top bar's
  account items into the shell's AccountMenu; the org switcher replaces
  any existing org picker.
- Command palette registry: every nav item as a static page, plus the
  app's obvious entity search (issue titles, identities by email, runbook
  names) where an API exists.
- Verify: `npm run build` (or the app's typecheck) green, run the dev
  server and exercise the shell (switcher open/close, chord G O, ⌘K,
  sidebar collapse with ⌘B, light/dark) with a quick Playwright or
  manual check via curl of the built index; do not leave console errors.
- Commit on a branch named `shell` in each repo under the repo's git
  identity (user.name "Chris Kolenko", user.email
  "1318186+chriskolenko@users.noreply.github.com"). No Co-Authored-By
  lines and no Claude attribution anywhere (commit messages, code, PR
  text). Do not push; I will.
- Report: what changed (files, routes), how the session model was
  built, anything from the design you could not do and why, and any
  shell bugs you fixed (with the shell commit sha).
