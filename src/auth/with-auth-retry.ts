/** The 401 fallback.
 *
 *  With the scheduled refresh doing its job a 401 should be rare: the access
 *  token is rotated at 80% of its life, and on focus, and on wake. But rare is
 *  not never — a clock that drifted, a token revoked mid-request, a tab that
 *  came back from sleep and fired its request before its refresh — so an API
 *  call that comes back 401 refreshes once and retries once.
 *
 *  Once, in both halves, is the whole design. The refresh is the client's
 *  single-flight one, so twenty requests failing together share a rotation and
 *  the other tabs adopt it. The retry does not loop: a second 401 is the
 *  answer, not an invitation. A refresh that fails hands back the original 401
 *  rather than throwing something new at the caller — whether the session is
 *  over is the client's verdict (`invalid_grant`), reported to whoever
 *  subscribed to it, and not this wrapper's to guess from a status code. */

import type { Tokens } from "./client"

/** What this wrapper needs of an {@link AuthClient}, narrowed so an app can
 *  pass its own thing and a test can pass a stub. */
export interface AuthTokenSource {
  getAccessToken(): Promise<string | null>
  refresh(): Promise<Tokens>
}

/** `fetch`, or anything shaped like it — an app's own wrapper included. */
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface AuthRetryOptions {
  /** Statuses that mean "that access token was not accepted". Default `[401]`.
   *  403 is deliberately not in it: that is an answer about permissions, and
   *  rotating a token will not change it. */
  statuses?: readonly number[]
  /** Set the Authorization header from the client before each attempt. Pass
   *  false when the app attaches credentials itself. Default true. */
  authorize?: boolean
  /** Header and scheme to carry the access token. Default `Authorization` and
   *  `Bearer`. */
  header?: string
  scheme?: string
}

/** Wrap a fetch-like call so a 401 triggers exactly one refresh and exactly one
 *  retry of the same request.
 *
 *  The request is replayed from the `input` and `init` it was given, so a body
 *  that can only be read once — a `ReadableStream`, a consumed `Request` — can
 *  not be retried. Strings, `FormData`, `URLSearchParams` and buffers all can.
 *
 *  ```ts
 *  const api = withAuthRetry(fetch, authClient)
 *  const response = await api("/api/runbooks")
 *  ```
 */
export function withAuthRetry(
  fetchLike: FetchLike,
  client: AuthTokenSource,
  options: AuthRetryOptions = {},
): FetchLike {
  const statuses = new Set(options.statuses ?? [401])
  const authorize = options.authorize ?? true
  const header = options.header ?? "Authorization"
  const scheme = options.scheme ?? "Bearer"

  async function attempt(input: RequestInfo | URL, init: RequestInit | undefined): Promise<Response> {
    if (!authorize) return fetchLike(input, init)
    const accessToken = await client.getAccessToken()
    if (accessToken === null) return fetchLike(input, init)
    // A `Request` carries its own headers; `init.headers` wins where both are
    // given, as it does for `fetch` itself. `Request` is guarded because a
    // fetch-like need not come with one (a worker, a test double, SSR).
    const inherited =
      typeof Request === "function" && input instanceof Request ? input.headers : undefined
    const headers = new Headers(init?.headers ?? inherited)
    headers.set(header, `${scheme} ${accessToken}`)
    return fetchLike(input, { ...init, headers })
  }

  return async (input, init) => {
    const first = await attempt(input, init)
    if (!statuses.has(first.status)) return first
    try {
      await client.refresh()
    } catch {
      // Nothing rotated. The caller gets the 401 it would have got anyway; the
      // session's fate is the client's to announce, not this wrapper's.
      return first
    }
    return attempt(input, init)
  }
}
