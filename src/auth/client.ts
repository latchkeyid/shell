/** The core of the Latchkey OIDC token client.
 *
 *  Signed in means *holding a refresh token*, never *holding an access token
 *  that has not expired yet*: an expired access token sitting beside a live
 *  refresh token is a token to rotate, not a session to end. On top of that
 *  store this module puts a refresh scheduled before the access token expires
 *  (re-armed on every rotation, plus a refresh on focus and on wake, since a
 *  sleeping laptop's timer does not fire), single-flight rotation so racing
 *  callers share one network call, and retry with backoff that gives up on the
 *  attempt but not on the session.
 *
 *  Tabs coordinate over a {@link CrossTabChannel}: the tab that rotates tells
 *  the others, and a tab that is told adopts what it was told instead of
 *  rotating again — which is what makes N open tabs rotate once. The 401
 *  fallback is `withAuthRetry`, next door. */

import { readJson, removeKey, writeJson } from "../lib/storage"
import { createCrossTabChannel, createNullChannel, type CrossTabChannel } from "./cross-tab"

/** localStorage key holding the token set. */
export const DEFAULT_STORAGE_KEY = "latchkey.tokens"
/** Fraction of the access token's life after which a refresh is armed. */
export const DEFAULT_REFRESH_AT = 0.8
/** An access token this close to expiry counts as stale on focus or wake. */
export const DEFAULT_STALE_WINDOW_MS = 60_000
/** Floor on the armed delay, so a short or already-expired token cannot spin. */
export const DEFAULT_MIN_DELAY_MS = 1_000
export const DEFAULT_MAX_ATTEMPTS = 6
export const DEFAULT_BASE_BACKOFF_MS = 1_000
export const DEFAULT_MAX_BACKOFF_MS = 30_000
/** Assumed access token life when the response carries neither `exp` nor `expires_in`. */
export const DEFAULT_ACCESS_TOKEN_TTL_MS = 300_000
/** Tag on every cross-tab message: a channel name or a storage key is shared
 *  with whatever else runs on the origin, so nothing untagged is ours. */
export const CROSS_TAB_MESSAGE_TAG = "latchkey.auth/1"

export interface Tokens {
  access_token: string
  refresh_token: string
  /** Epoch ms at which the access token expires. */
  expires_at: number
}

/** What the token endpoint answered. The status and the body are handed over
 *  raw: classifying them (rotated, refused, try again later) is this module's
 *  job, not the caller's. */
export interface TokenEndpointResponse {
  status: number
  body: unknown
}

/** The one network call this client makes, injected so tests can drive it and
 *  so an app can wrap it in its own fetch. It rejects on a network error and
 *  resolves for every HTTP status, 5xx included. */
export type TokenEndpointCall = (refreshToken: string) => Promise<TokenEndpointResponse>

export type AuthErrorCode =
  /** The issuer refused the refresh token. The session is over. */
  | "invalid_grant"
  /** Nothing to rotate: no session is held. */
  | "no_refresh_token"
  /** Every attempt failed on the network or on the issuer's side. The session stands. */
  | "exhausted"
  /** The session ended (another tab, a sign-out) while this refresh was retrying. */
  | "stopped"

export class AuthError extends Error {
  readonly code: AuthErrorCode

  constructor(code: AuthErrorCode, message: string, cause?: unknown) {
    super(message, { cause })
    this.name = "AuthError"
    this.code = code
  }
}

function decodeBase64Url(segment: string): string | undefined {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
  try {
    if (typeof atob === "function") return atob(padded)
    return Buffer.from(padded, "base64").toString("binary")
  } catch {
    return undefined
  }
}

/** Epoch ms of the access token's `exp` claim, or undefined when it cannot be
 *  read. The signature is never checked and never needs to be: the claim only
 *  informs *when* to rotate — the issuer remains the judge of the token. */
export function accessTokenExpiry(accessToken: string): number | undefined {
  const payload = accessToken.split(".")[1]
  if (!payload) return undefined
  const json = decodeBase64Url(payload)
  if (!json) return undefined
  try {
    const claims: unknown = JSON.parse(json)
    if (typeof claims !== "object" || claims === null) return undefined
    const exp = (claims as { exp?: unknown }).exp
    return typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : undefined
  } catch {
    return undefined
  }
}

function isTokens(value: unknown): value is Tokens {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.access_token === "string" &&
    typeof candidate.refresh_token === "string" &&
    typeof candidate.expires_at === "number"
  )
}

/** A session is held while a refresh token is. Deliberately says nothing about
 *  `expires_at`: that field schedules rotation, it does not decide sign-in. */
export function holdsSession(tokens: Tokens | null): tokens is Tokens {
  return tokens !== null && tokens.refresh_token.length > 0
}

export function readTokens(storageKey: string = DEFAULT_STORAGE_KEY): Tokens | null {
  const stored = readJson<unknown>(storageKey, null)
  return isTokens(stored) ? stored : null
}

export function writeTokens(tokens: Tokens, storageKey: string = DEFAULT_STORAGE_KEY): void {
  writeJson(storageKey, tokens)
}

export function clearTokens(storageKey: string = DEFAULT_STORAGE_KEY): void {
  removeKey(storageKey)
}

/** What one tab tells the others: it rotated, or the session is over. */
export type CrossTabAuthMessage =
  | { tag: typeof CROSS_TAB_MESSAGE_TAG; type: "rotated"; tokens: Tokens }
  | { tag: typeof CROSS_TAB_MESSAGE_TAG; type: "ended" }

/** Validate an inbound payload. It crossed a process boundary, so it is parsed
 *  rather than cast: a malformed or foreign message is dropped, not adopted. */
export function parseCrossTabMessage(payload: unknown): CrossTabAuthMessage | null {
  if (typeof payload !== "object" || payload === null) return null
  const message = payload as Record<string, unknown>
  if (message.tag !== CROSS_TAB_MESSAGE_TAG) return null
  if (message.type === "ended") return { tag: CROSS_TAB_MESSAGE_TAG, type: "ended" }
  if (message.type === "rotated" && isTokens(message.tokens)) {
    return { tag: CROSS_TAB_MESSAGE_TAG, type: "rotated", tokens: message.tokens }
  }
  return null
}

/** The OAuth `error` code in a token endpoint body, per RFC 6749 §5.2. */
export function oauthError(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined
  const error = (body as { error?: unknown }).error
  return typeof error === "string" ? error : undefined
}

/** Normalise a token endpoint body into a stored token set. A rotation that
 *  omits `refresh_token` keeps the one presented. `exp` wins over `expires_in`
 *  because it is what the resource server will read. */
export function tokensFromResponse(body: unknown, presentedRefreshToken: string, now: number): Tokens | null {
  if (typeof body !== "object" || body === null) return null
  const record = body as Record<string, unknown>
  const accessToken = typeof record.access_token === "string" ? record.access_token : ""
  if (!accessToken) return null
  const rotated = typeof record.refresh_token === "string" ? record.refresh_token : ""
  const expiresIn = typeof record.expires_in === "number" ? record.expires_in : undefined
  const expiry = accessTokenExpiry(accessToken)
  return {
    access_token: accessToken,
    refresh_token: rotated || presentedRefreshToken,
    expires_at: expiry ?? (expiresIn !== undefined ? now + expiresIn * 1000 : now + DEFAULT_ACCESS_TOKEN_TTL_MS),
  }
}

/** The slice of `window` and `document` this client listens on, narrowed so a
 *  test — or a worker, or SSR — can pass null or a stub. */
export interface ListenerTarget {
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

export interface AuthClientOptions {
  exchange: TokenEndpointCall
  /** Seed the store instead of reading localStorage (mainly for tests). */
  tokens?: Tokens | null
  storageKey?: string
  refreshAt?: number
  staleWindowMs?: number
  minDelayMs?: number
  maxAttempts?: number
  baseBackoffMs?: number
  maxBackoffMs?: number
  now?: () => number
  /** 0..1, multiplied into the back half of each backoff delay. */
  jitter?: () => number
  win?: ListenerTarget | null
  doc?: (ListenerTarget & { visibilityState?: string }) | null
  /** How this tab reaches the others. Defaults to `BroadcastChannel` falling
   *  back to the `storage` event; pass null to run this client on its own. */
  channel?: CrossTabChannel | null
  /** Name of the default channel. Defaults to `${storageKey}.sync`. */
  channelName?: string
}

export type TokensListener = (tokens: Tokens | null) => void

export class AuthClient {
  private readonly exchange: TokenEndpointCall
  private readonly storageKey: string
  private readonly refreshAt: number
  private readonly staleWindowMs: number
  private readonly minDelayMs: number
  private readonly maxAttempts: number
  private readonly baseBackoffMs: number
  private readonly maxBackoffMs: number
  private readonly now: () => number
  private readonly jitter: () => number
  private readonly win: ListenerTarget | null
  private readonly doc: (ListenerTarget & { visibilityState?: string }) | null
  private readonly channel: CrossTabChannel

  private readonly listeners = new Set<TokensListener>()
  private unlisten: (() => void) | null = null
  private tokens: Tokens | null = null
  private inFlight: Promise<Tokens> | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private started = false

  /** Focus and visibility share one handler: both mean "this tab is in front
   *  again", and a laptop waking from sleep is the case a timer cannot cover. */
  private readonly onWake = (): void => {
    if (!this.started || this.inFlight) return
    if (this.doc && this.doc.visibilityState === "hidden") return
    if (!holdsSession(this.tokens)) return
    if (this.now() < this.tokens.expires_at - this.staleWindowMs) return
    void this.refresh().catch(() => {})
  }

  constructor(options: AuthClientOptions) {
    this.exchange = options.exchange
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY
    this.refreshAt = options.refreshAt ?? DEFAULT_REFRESH_AT
    this.staleWindowMs = options.staleWindowMs ?? DEFAULT_STALE_WINDOW_MS
    this.minDelayMs = options.minDelayMs ?? DEFAULT_MIN_DELAY_MS
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
    this.baseBackoffMs = options.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS
    this.maxBackoffMs = options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS
    this.now = options.now ?? (() => Date.now())
    this.jitter = options.jitter ?? (() => Math.random())
    this.win = options.win === undefined ? (globalThis.window ?? null) : options.win
    this.doc = options.doc === undefined ? (globalThis.document ?? null) : options.doc
    this.channel =
      options.channel === undefined
        ? createCrossTabChannel(options.channelName ?? `${this.storageKey}.sync`)
        : (options.channel ?? createNullChannel())

    if (options.tokens === undefined) {
      this.tokens = readTokens(this.storageKey)
    } else if (options.tokens === null) {
      this.tokens = null
    } else {
      this.tokens = options.tokens
      writeTokens(options.tokens, this.storageKey)
    }
  }

  /** The token set this client holds, or null. */
  snapshot(): Tokens | null {
    return this.tokens
  }

  /** Holding a refresh token — see {@link holdsSession}. */
  isSignedIn(): boolean {
    return holdsSession(this.tokens)
  }

  subscribe(listener: TokensListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Adopt the tokens already in storage, arm the schedule and start listening
   *  for focus and wake. Idempotent. */
  start(): void {
    if (this.started) return
    this.started = true
    this.tokens = readTokens(this.storageKey) ?? this.tokens
    this.unlisten = this.channel.listen(this.onMessage)
    this.win?.addEventListener("focus", this.onWake)
    this.doc?.addEventListener("visibilitychange", this.onWake)
    this.arm()
  }

  /** Stop the schedule and the listeners. Does not touch the stored session. */
  stop(): void {
    if (!this.started) return
    this.started = false
    this.clearTimer()
    this.unlisten?.()
    this.unlisten = null
    this.win?.removeEventListener("focus", this.onWake)
    this.doc?.removeEventListener("visibilitychange", this.onWake)
  }

  /** Take on a token set this tab minted or rotated — a sign-in callback, or a
   *  rotation — persisting it, re-arming the schedule from it, and telling the
   *  other tabs so none of them rotates it again. */
  adopt(tokens: Tokens): Tokens {
    this.apply(tokens)
    this.channel.post({ tag: CROSS_TAB_MESSAGE_TAG, type: "rotated", tokens })
    return tokens
  }

  /** Drop the session here and in every other tab: clear the store, cancel the
   *  schedule, tell subscribers. Only ever reached by `invalid_grant` or a
   *  deliberate sign-out — never by a network error or a 5xx. */
  endSession(): void {
    this.clearSession()
    this.channel.post({ tag: CROSS_TAB_MESSAGE_TAG, type: "ended" })
  }

  /** A sibling tab rotated, or ended the session. Neither is a reason to call
   *  the token endpoint: the work has already been done and this tab's part is
   *  to take the result, re-arming its own schedule from the new token so its
   *  timer moves out with everyone else's. */
  private readonly onMessage = (payload: unknown): void => {
    const message = parseCrossTabMessage(payload)
    if (!message) return
    if (message.type === "ended") {
      if (this.tokens !== null) this.clearSession()
      return
    }
    if (this.tokens?.refresh_token === message.tokens.refresh_token) return
    this.apply(message.tokens)
  }

  /** Hold a token set, without telling anyone: the half of `adopt` that a
   *  message from another tab must not echo back to it. */
  private apply(tokens: Tokens): Tokens {
    this.tokens = tokens
    writeTokens(tokens, this.storageKey)
    this.arm()
    this.emit()
    return tokens
  }

  private clearSession(): void {
    this.clearTimer()
    this.tokens = null
    clearTokens(this.storageKey)
    this.emit()
  }

  /** Rotate the refresh token. Concurrent callers share exactly one network
   *  call — including its retries — and all resolve to its result. */
  refresh(): Promise<Tokens> {
    if (this.inFlight) return this.inFlight
    const flight = this.rotate().finally(() => {
      if (this.inFlight === flight) this.inFlight = null
    })
    this.inFlight = flight
    return flight
  }

  /** An access token safe to send: the stored one while it has life left,
   *  otherwise the result of a rotation. Null when no session is held. */
  async getAccessToken(): Promise<string | null> {
    const current = this.tokens
    if (!holdsSession(current)) return null
    if (current.access_token && this.now() < current.expires_at - this.staleWindowMs) {
      return current.access_token
    }
    return (await this.refresh()).access_token
  }

  private async rotate(): Promise<Tokens> {
    const held = this.tokens
    if (!holdsSession(held)) {
      throw new AuthError("no_refresh_token", "no refresh token to rotate")
    }
    let last: unknown
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const response = await this.exchange(held.refresh_token)
        const current = this.tokens
        if (holdsSession(current) && current.refresh_token !== held.refresh_token) {
          // Another tab rotated while this call was in the air. The token this
          // call presented is a spent one, so whatever the issuer answered
          // about it says nothing about the session — including `invalid_grant`,
          // which here would end a session that is demonstrably alive.
          return current
        }
        if (oauthError(response.body) === "invalid_grant") {
          // The one answer that means the session is over. Everything else is
          // this request failing, not the person being signed out.
          this.endSession()
          throw new AuthError("invalid_grant", "the issuer refused the refresh token")
        }
        if (response.status >= 200 && response.status < 300) {
          const next = tokensFromResponse(response.body, held.refresh_token, this.now())
          if (next) return this.adopt(next)
          last = new Error("the token endpoint returned no access token")
        } else {
          last = new Error(`the token endpoint returned ${response.status}`)
        }
      } catch (error) {
        if (error instanceof AuthError) throw error
        last = error
      }
      if (attempt === this.maxAttempts) break
      await this.sleep(this.backoffMs(attempt))
      const afterBackoff = this.tokens
      if (!holdsSession(afterBackoff)) {
        throw new AuthError("stopped", "the session ended while the refresh was retrying")
      }
      // A sibling tab got through while this one was backing off. Its token is
      // the live one; retrying with the spent one would only fail.
      if (afterBackoff.refresh_token !== held.refresh_token) return afterBackoff
    }
    // Out of attempts, but the refresh token was never refused: keep the
    // session so the next timer, focus or 401 can try again.
    throw new AuthError("exhausted", "the token endpoint could not be reached", last)
  }

  private backoffMs(attempt: number): number {
    const ceiling = Math.min(this.maxBackoffMs, this.baseBackoffMs * 2 ** (attempt - 1))
    return Math.round(ceiling * (0.5 + 0.5 * this.jitter()))
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /** Arm the refresh at `refreshAt` of the access token's remaining life,
   *  measured from now — which is mint or rotation time on every path that
   *  reaches here, so each rotation re-arms the next one. */
  private arm(): void {
    this.clearTimer()
    if (!this.started || !holdsSession(this.tokens)) return
    const delay = Math.max(this.minDelayMs, (this.tokens.expires_at - this.now()) * this.refreshAt)
    this.timer = setTimeout(() => {
      this.timer = null
      void this.refresh().catch(() => {})
    }, delay)
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.tokens)
  }
}

export interface FetchTokenEndpointOptions {
  tokenEndpoint: string
  clientId: string
  fetchImpl?: typeof fetch
}

/** The default {@link TokenEndpointCall}: an RFC 6749 §6 refresh grant, form
 *  encoded, resolving for every status so the client can tell "refused" from
 *  "try again". */
export function createTokenEndpointCall(options: FetchTokenEndpointOptions): TokenEndpointCall {
  const doFetch = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args))
  return async (refreshToken) => {
    const response = await doFetch(options.tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: options.clientId,
      }).toString(),
      credentials: "omit",
    })
    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      body = null
    }
    return { status: response.status, body }
  }
}
