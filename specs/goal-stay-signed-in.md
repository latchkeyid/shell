---
title: Goal — Stay signed in: silent refresh in the shell's auth client, prompt=none on the issuer
kind: plan
status: draft
---

# Goal — Stay signed in: silent refresh in the shell's auth client, prompt=none on the issuer

Mesh goal `stay-signed-in`, running.

## Statement

People using apps that sign in through Latchkey — the runsheet console above all — are logged out while they are still working. They come back to a tab, or leave one open for an hour, and the app has forgotten them; they sign in again, several times a day. Nothing is wrong with their session on the issuer: it is the client side giving up on a token that could have been renewed silently.

What is already true (read the source before changing anything, and correct this where it is wrong). **The issuer is in good shape**: a refresh rotates on every use with a reuse grace window after a rotation (`Config.RefreshGrace`, `refreshGrant` in `oidc/oidc.go`, default sub-second but minutes in production — two gateway instances racing, and a tab replaying a cookie the browser never updated, were both seen); a session's expiry *slides*, rescheduled to `last_refresh + session_ttl` on every rotation (`identity/policies/schedulesessionexpiry.go`, `sessionWindow`, 30-day default inactivity window, per-client `session_ttl` 5 minutes to 90 days); and the access token's TTL is per client, one hour by default, 1 minute to 24 hours (`identity/aggregates/oidcclient.go`). So a person who used an app yesterday still has a live session today. **The clients are not**: the runsheet console (`runsheet/console`, `src/auth.ts` — another org's repo, named here only as the evidence) refreshes *only reactively*, when a call comes back 401 (`src/api.ts`), and its `authed()` is `tokens() && claims().exp * 1000 > Date.now() - 30_000` — so the moment the **access** token's hour is up the app considers the person signed out, though a valid refresh token is sitting in localStorage beside it. A failed refresh calls `signOut()` at once, so one flaky network response ends the session for good.

The fix belongs where every app can have it: **an auth client in `@latchkey/shell`** (this project's `shell` repo) that apps adopt instead of writing their own, and whatever the issuer needs to support it.

In the shell's client: signed-in means *holding a live session*, not *holding an unexpired access token*; a refresh scheduled before the access token expires (a timer at, say, 80% of its life, re-armed on each rotation, and a refresh on window focus and on wake from sleep, since a sleeping laptop's timer does not fire); **single-flight** — concurrent callers share one in-flight refresh rather than each presenting the same rotating token; **cross-tab** — tabs coordinate through a storage event or a `BroadcastChannel` so five open tabs do not rotate five times, and a tab that learns of a new token adopts it; a failed refresh is retried with backoff and only ends the session when the issuer actually refuses it (`invalid_grant`), never on a network error or a 5xx; and a 401 from an API still triggers a refresh and one retry, as the fallback it should be rather than the only path.

On the issuer, what that client needs and does not have: **silent re-authentication** — an authorization request with `prompt=none` that, when the browser still holds the issuer's own session, returns a code without showing anything, and returns `login_required` otherwise (there is no `prompt` handling in `oidc/` today). That is what lets an app recover when its refresh token is gone or was revoked, without throwing the person at a login screen. Decide whether third-party cookie behaviour makes a hidden iframe unusable in current browsers and, if so, do it as a top-level redirect that returns to where the person was. Consider too whether the console's client wants a longer access-token TTL than an hour now that refresh is silent, and whether `session_ttl` deserves a default other than 30 days for a staff-facing console.

Write it down: an ADR in this repo (`specs/`, next free number) recording the decision — what "signed in" means, where refresh belongs, and what `prompt=none` is for — and the shell's README section on adopting the client. The runsheet console's swap to it is a separate goal on the runsheet project; this one ships the client and the issuer support, and says in the ADR what an app must do to adopt it.

## Acceptance

- An ADR in `specs/` (next free number, this repo's frontmatter shape with a one-line `summary:`) states the decision: signed-in means a live session, refresh is proactive and single-flight in the shell's client, `prompt=none` is the recovery path, and what an app must do to adopt it.
- `@latchkey/shell` exports an auth client with: a scheduled refresh before the access token expires, re-armed on rotation, plus refresh on focus and on wake; single-flight (concurrent callers share one in-flight refresh); cross-tab coordination so N tabs rotate once and all adopt the result; retry with backoff on network and 5xx, ending the session only on the issuer's `invalid_grant`; and a 401 hook that refreshes and retries once. Its tests cover each of those, including two callers racing and a tab adopting another tab's rotation.
- The issuer supports `prompt=none`: an authorization request with it returns a code without interaction when the browser holds a live session, and the OIDC error `login_required` when it does not; an e2e proves both, and proves `prompt=none` never shows a login form or a consent screen.
- The shell's README documents adopting the client, and the issuer's docs note `prompt=none`.
- `go test ./...` passes in the issuer and whatever the shell's suite is (`npm test` / `npm run check` / `npm run build`); `loom generate` leaves no diff if the schema changed.

## Items

| Seq | Title | Status | Branch | PR | Cost |
| --- | --- | --- | --- | --- | --- |
| 1 | Issuer: prompt=none silent re-authentication + the stay-signed-in ADR | claimed | — | — | $0.00 |
| 2 | Shell auth client: proactive refresh, single-flight, retry-with-backoff | claimed | — | — | $0.00 |
| 3 | Shell auth client: cross-tab coordination, the 401 hook, exports, and the adoption README | pending | — | — | $0.00 |

## Log

- 2026-09-23 · item 2 · session started
