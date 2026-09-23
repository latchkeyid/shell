import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AuthClient, writeTokens, type TokenEndpointResponse, type Tokens } from "@/auth/client"
import { withAuthRetry, type FetchLike } from "@/auth/with-auth-retry"

const NOW = new Date("2026-09-23T10:00:00Z").getTime()

function base64Url(value: object): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function accessToken(name: string, seconds: number): string {
  return `${base64Url({ alg: "none", typ: "JWT" })}.${base64Url({
    sub: "usr_kestrel",
    jti: name,
    exp: Math.floor((Date.now() + seconds * 1000) / 1000),
  })}.`
}

function seed(refreshToken: string, accessName: string, accessTtlSeconds: number): Tokens {
  const tokens: Tokens = {
    access_token: accessToken(accessName, accessTtlSeconds),
    refresh_token: refreshToken,
    expires_at: Date.now() + accessTtlSeconds * 1000,
  }
  writeTokens(tokens)
  return tokens
}

function rotated(refreshToken: string, accessName: string, accessTtlSeconds: number): TokenEndpointResponse {
  return {
    status: 200,
    body: {
      access_token: accessToken(accessName, accessTtlSeconds),
      refresh_token: refreshToken,
      expires_in: accessTtlSeconds,
      token_type: "Bearer",
    },
  }
}

/** A client with no schedule, no listeners and no channel: this file is about
 *  the wrapper around it. */
function offlineClient(exchange: (refreshToken: string) => Promise<TokenEndpointResponse>): AuthClient {
  return new AuthClient({ exchange, win: null, doc: null, channel: null })
}

/** Replies in order; a call past the end is the failure the test is looking for. */
function fetchReturning(...responses: Array<() => Response>): FetchLike {
  let call = 0
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    const next = responses[call]
    call += 1
    if (!next) throw new Error(`unexpected fetch call ${call}`)
    return next()
  })
}

const unauthorized = (): Response => new Response(JSON.stringify({ error: "invalid_token" }), { status: 401 })
const ok = (): Response => new Response(JSON.stringify({ runbooks: [] }), { status: 200 })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("the 401 hook", () => {
  it("refreshes once and retries once, resolving with the retry", async () => {
    seed("rt_0", "at_0", 3600)
    const exchange = vi.fn(async (_refreshToken: string) => rotated("rt_1", "at_1", 3600))
    const client = offlineClient(exchange)
    const refresh = vi.spyOn(client, "refresh")
    const doFetch = fetchReturning(unauthorized, ok)

    const response = await withAuthRetry(doFetch, client)("/api/runbooks")

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ runbooks: [] })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(exchange).toHaveBeenCalledTimes(1)
    expect(exchange).toHaveBeenCalledWith("rt_0")
    expect(doFetch).toHaveBeenCalledTimes(2)

    // Same request both times; the second carries the token the refresh minted.
    const [first, second] = vi.mocked(doFetch).mock.calls
    expect(first?.[0]).toBe("/api/runbooks")
    expect(second?.[0]).toBe("/api/runbooks")
    expect(new Headers(first?.[1]?.headers).get("authorization")).toBe(`Bearer ${accessToken("at_0", 3600)}`)
    expect(new Headers(second?.[1]?.headers).get("authorization")).toBe(`Bearer ${accessToken("at_1", 3600)}`)
  })

  it("does not refresh or retry when the call succeeds", async () => {
    seed("rt_0", "at_0", 3600)
    const exchange = vi.fn(async (_refreshToken: string) => rotated("rt_1", "at_1", 3600))
    const client = offlineClient(exchange)
    const refresh = vi.spyOn(client, "refresh")
    const doFetch = fetchReturning(ok)

    await expect(withAuthRetry(doFetch, client)("/api/runbooks")).resolves.toMatchObject({ status: 200 })

    expect(refresh).not.toHaveBeenCalled()
    expect(doFetch).toHaveBeenCalledTimes(1)
  })

  it("hands back a second 401 rather than looping", async () => {
    seed("rt_0", "at_0", 3600)
    const client = offlineClient(async (_refreshToken: string) => rotated("rt_1", "at_1", 3600))
    const refresh = vi.spyOn(client, "refresh")
    const doFetch = fetchReturning(unauthorized, unauthorized)

    const response = await withAuthRetry(doFetch, client)("/api/runbooks")

    expect(response.status).toBe(401)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(doFetch).toHaveBeenCalledTimes(2)
  })

  it("shares one rotation between requests that fail together", async () => {
    seed("rt_0", "at_0", 3600)
    const exchange = vi.fn(async (_refreshToken: string) => rotated("rt_1", "at_1", 3600))
    const client = offlineClient(exchange)
    const doFetch = fetchReturning(unauthorized, unauthorized, unauthorized, ok, ok, ok)
    const api = withAuthRetry(doFetch, client)

    const all = await Promise.all([api("/api/a"), api("/api/b"), api("/api/c")])

    expect(all.map((response) => response.status)).toEqual([200, 200, 200])
    // Single-flight: three 401s, one call to the token endpoint.
    expect(exchange).toHaveBeenCalledTimes(1)
    expect(doFetch).toHaveBeenCalledTimes(6)
  })

  it("returns the original 401 when the refresh cannot rotate", async () => {
    seed("rt_0", "at_0", 3600)
    const exchange = vi.fn(async (_refreshToken: string) => ({ status: 400, body: { error: "invalid_grant" } }))
    const client = offlineClient(exchange)
    const ended = vi.fn()
    client.subscribe((tokens) => {
      if (tokens === null) ended()
    })
    const doFetch = fetchReturning(unauthorized)

    const response = await withAuthRetry(doFetch, client)("/api/runbooks")

    expect(response.status).toBe(401)
    expect(doFetch).toHaveBeenCalledTimes(1)
    // The wrapper did not invent a verdict; the client reached its own.
    expect(ended).toHaveBeenCalledTimes(1)
    expect(client.isSignedIn()).toBe(false)
  })

  it("leaves 403 and 500 alone", async () => {
    seed("rt_0", "at_0", 3600)
    const client = offlineClient(async (_refreshToken: string) => rotated("rt_1", "at_1", 3600))
    const refresh = vi.spyOn(client, "refresh")
    const doFetch = fetchReturning(
      () => new Response(null, { status: 403 }),
      () => new Response(null, { status: 500 }),
    )
    const api = withAuthRetry(doFetch, client)

    expect((await api("/api/runbooks")).status).toBe(403)
    expect((await api("/api/runbooks")).status).toBe(500)
    expect(refresh).not.toHaveBeenCalled()
    expect(doFetch).toHaveBeenCalledTimes(2)
  })

  it("sends nothing and retries nothing when no session is held", async () => {
    const client = new AuthClient({
      exchange: vi.fn(),
      tokens: null,
      win: null,
      doc: null,
      channel: null,
    })
    const doFetch = fetchReturning(unauthorized)

    const response = await withAuthRetry(doFetch, client)("/api/runbooks")

    expect(response.status).toBe(401)
    expect(doFetch).toHaveBeenCalledTimes(1)
    expect(new Headers(vi.mocked(doFetch).mock.calls[0]?.[1]?.headers).has("authorization")).toBe(false)
  })

  it("keeps the caller's headers and leaves them alone when authorize is off", async () => {
    seed("rt_0", "at_0", 3600)
    const client = offlineClient(async (_refreshToken: string) => rotated("rt_1", "at_1", 3600))
    const doFetch = fetchReturning(ok, ok)

    await withAuthRetry(doFetch, client)("/api/runbooks", {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": "req_gull" },
      body: "{}",
    })
    await withAuthRetry(doFetch, client, { authorize: false })("/api/runbooks", {
      headers: { authorization: "Bearer mine" },
    })

    const [first, second] = vi.mocked(doFetch).mock.calls
    expect(first?.[1]?.method).toBe("POST")
    expect(first?.[1]?.body).toBe("{}")
    expect(new Headers(first?.[1]?.headers).get("x-request-id")).toBe("req_gull")
    expect(new Headers(first?.[1]?.headers).get("authorization")).toBe(`Bearer ${accessToken("at_0", 3600)}`)
    expect(new Headers(second?.[1]?.headers).get("authorization")).toBe("Bearer mine")
  })

  it("takes a custom status list, header and scheme", async () => {
    seed("rt_0", "at_0", 3600)
    const exchange = vi.fn(async (_refreshToken: string) => rotated("rt_1", "at_1", 3600))
    const client = offlineClient(exchange)
    const doFetch = fetchReturning(() => new Response(null, { status: 419 }), ok)

    const response = await withAuthRetry(doFetch, client, {
      statuses: [401, 419],
      header: "x-latchkey-token",
      scheme: "Token",
    })("/api/runbooks")

    expect(response.status).toBe(200)
    expect(exchange).toHaveBeenCalledTimes(1)
    expect(new Headers(vi.mocked(doFetch).mock.calls[1]?.[1]?.headers).get("x-latchkey-token")).toBe(
      `Token ${accessToken("at_1", 3600)}`,
    )
  })
})
