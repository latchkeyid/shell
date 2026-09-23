import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  AuthClient,
  accessTokenExpiry,
  holdsSession,
  readTokens,
  tokensFromResponse,
  writeTokens,
  type TokenEndpointResponse,
  type Tokens,
} from "@/auth/client"

const NOW = new Date("2026-09-23T10:00:00Z").getTime()

function base64Url(value: object): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** An unsigned JWT whose `exp` lands `seconds` from the clock's current reading. */
function accessToken(seconds: number): string {
  return `${base64Url({ alg: "none", typ: "JWT" })}.${base64Url({
    sub: "usr_kestrel",
    exp: Math.floor((Date.now() + seconds * 1000) / 1000),
  })}.`
}

function seed(refreshToken: string, accessTtlSeconds: number): Tokens {
  const tokens: Tokens = {
    access_token: accessToken(accessTtlSeconds),
    refresh_token: refreshToken,
    expires_at: Date.now() + accessTtlSeconds * 1000,
  }
  writeTokens(tokens)
  return tokens
}

/** A 200 from the token endpoint that rotates the refresh token, as Latchkey does. */
function rotated(refreshToken: string, accessTtlSeconds: number): TokenEndpointResponse {
  return {
    status: 200,
    body: {
      access_token: accessToken(accessTtlSeconds),
      refresh_token: refreshToken,
      expires_in: accessTtlSeconds,
      token_type: "Bearer",
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("the token store", () => {
  it("reads the access token's exp without verifying it", () => {
    expect(accessTokenExpiry(accessToken(3600))).toBe(Math.floor((NOW + 3_600_000) / 1000) * 1000)
    expect(accessTokenExpiry("not-a-jwt")).toBeUndefined()
    expect(accessTokenExpiry("a.!!!.c")).toBeUndefined()
  })

  it("counts a session as held while a refresh token is, expired access token or not", () => {
    const expired: Tokens = { access_token: accessToken(-600), refresh_token: "rt_live", expires_at: NOW - 600_000 }
    expect(holdsSession(expired)).toBe(true)
    expect(new AuthClient({ exchange: vi.fn(), tokens: expired, win: null, doc: null }).isSignedIn()).toBe(true)

    const noRefresh: Tokens = { access_token: accessToken(3600), refresh_token: "", expires_at: NOW + 3_600_000 }
    expect(holdsSession(noRefresh)).toBe(false)
    expect(new AuthClient({ exchange: vi.fn(), tokens: noRefresh, win: null, doc: null }).isSignedIn()).toBe(false)
  })

  it("keeps the presented refresh token when a rotation omits one", () => {
    expect(tokensFromResponse({ access_token: "a.b.c", expires_in: 60 }, "rt_kept", NOW)).toEqual({
      access_token: "a.b.c",
      refresh_token: "rt_kept",
      expires_at: NOW + 60_000,
    })
    expect(tokensFromResponse({ token_type: "Bearer" }, "rt_kept", NOW)).toBeNull()
  })
})

describe("single-flight", () => {
  it("gives two racing callers one network call and one result", async () => {
    let release!: (response: TokenEndpointResponse) => void
    const exchange = vi.fn(
      (_refreshToken: string) =>
        new Promise<TokenEndpointResponse>((resolve) => {
          release = resolve
        }),
    )
    const client = new AuthClient({ exchange, tokens: seed("rt_0", 3600), win: null, doc: null })

    const first = client.refresh()
    const second = client.refresh()
    expect(exchange).toHaveBeenCalledTimes(1)

    release(rotated("rt_1", 3600))
    const [a, b] = await Promise.all([first, second])

    expect(exchange).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
    expect(a.refresh_token).toBe("rt_1")
    expect(readTokens()?.refresh_token).toBe("rt_1")
  })

  it("starts a fresh flight once the first has settled", async () => {
    const exchange = vi.fn(async (refreshToken: string) => rotated(`${refreshToken}+`, 3600))
    const client = new AuthClient({ exchange, tokens: seed("rt_0", 3600), win: null, doc: null })

    await client.refresh()
    await client.refresh()

    expect(exchange).toHaveBeenCalledTimes(2)
    expect(exchange).toHaveBeenNthCalledWith(1, "rt_0")
    expect(exchange).toHaveBeenNthCalledWith(2, "rt_0+")
  })
})

describe("getAccessToken", () => {
  it("hands back the held token while it has life, and rotates once it has not", async () => {
    const exchange = vi.fn(async (_refreshToken: string) => rotated("rt_1", 3600))
    const fresh = seed("rt_0", 3600)
    const client = new AuthClient({ exchange, win: null, doc: null })

    expect(await client.getAccessToken()).toBe(fresh.access_token)
    expect(exchange).not.toHaveBeenCalled()

    client.adopt({ ...fresh, expires_at: Date.now() + 10_000 })
    expect(await client.getAccessToken()).toBe(client.snapshot()?.access_token)
    expect(exchange).toHaveBeenCalledTimes(1)
    expect(client.snapshot()?.refresh_token).toBe("rt_1")

    client.endSession()
    expect(await client.getAccessToken()).toBeNull()
  })
})

describe("the refresh schedule", () => {
  it("re-arms itself at 80% of each rotation's access token life", async () => {
    let issued = 0
    const exchange = vi.fn(async (_refreshToken: string) => {
      issued += 1
      return rotated(`rt_${issued}`, 1000)
    })
    seed("rt_0", 1000)
    const client = new AuthClient({ exchange, win: null, doc: null })
    client.start()

    // 80% of a 1000s access token: nothing at 795s, rotated by 805s.
    await vi.advanceTimersByTimeAsync(795_000)
    expect(exchange).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(10_000)
    expect(exchange).toHaveBeenCalledTimes(1)
    expect(exchange).toHaveBeenLastCalledWith("rt_0")

    // The rotation re-armed the timer from the new token, 800s on from itself,
    // rather than leaving the schedule to lapse with the token it replaced.
    await vi.advanceTimersByTimeAsync(790_000)
    expect(exchange).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(10_000)
    expect(exchange).toHaveBeenCalledTimes(2)
    expect(exchange).toHaveBeenLastCalledWith("rt_1")

    client.stop()
    await vi.advanceTimersByTimeAsync(2_000_000)
    expect(exchange).toHaveBeenCalledTimes(2)
  })

  it("refreshes on focus and on the tab becoming visible, but only when the token is stale", async () => {
    const exchange = vi.fn(async (_refreshToken: string) => rotated("rt_1", 3600))
    seed("rt_0", 3600)
    const client = new AuthClient({ exchange })
    client.start()

    window.dispatchEvent(new Event("focus"))
    await vi.advanceTimersByTimeAsync(0)
    expect(exchange).not.toHaveBeenCalled()

    // Wake an hour later, past the access token's expiry: the timer that should
    // have fired at 48 minutes never did, so focus has to cover it.
    client.adopt({ ...seed("rt_0", 30), expires_at: Date.now() + 30_000 })
    window.dispatchEvent(new Event("focus"))
    await vi.advanceTimersByTimeAsync(0)
    expect(exchange).toHaveBeenCalledTimes(1)

    client.adopt({ ...seed("rt_1", 30), expires_at: Date.now() + 30_000 })
    document.dispatchEvent(new Event("visibilitychange"))
    await vi.advanceTimersByTimeAsync(0)
    expect(exchange).toHaveBeenCalledTimes(2)

    client.stop()
    client.adopt({ ...seed("rt_2", 30), expires_at: Date.now() + 30_000 })
    window.dispatchEvent(new Event("focus"))
    await vi.advanceTimersByTimeAsync(0)
    expect(exchange).toHaveBeenCalledTimes(2)
  })
})

describe("retry with backoff", () => {
  it("rides out a network error and a 5xx without ending the session", async () => {
    const steps: Array<() => Promise<TokenEndpointResponse>> = [
      () => Promise.reject(new TypeError("Failed to fetch")),
      () => Promise.resolve({ status: 503, body: { error: "temporarily_unavailable" } }),
      () => Promise.resolve(rotated("rt_1", 3600)),
    ]
    let attempt = 0
    const exchange = vi.fn(async (_refreshToken: string) => {
      const step = steps[attempt]
      attempt += 1
      if (!step) throw new Error("unexpected extra call to the token endpoint")
      return step()
    })
    const cleared = vi.fn()
    seed("rt_0", 3600)
    const client = new AuthClient({ exchange, jitter: () => 1, win: null, doc: null })
    client.subscribe((tokens) => {
      if (tokens === null) cleared()
    })
    client.start()

    const refreshing = client.refresh()

    await vi.advanceTimersByTimeAsync(0)
    expect(exchange).toHaveBeenCalledTimes(1)
    expect(readTokens()?.refresh_token).toBe("rt_0")

    await vi.advanceTimersByTimeAsync(1_000)
    expect(exchange).toHaveBeenCalledTimes(2)
    expect(readTokens()?.refresh_token).toBe("rt_0")
    expect(client.isSignedIn()).toBe(true)

    await vi.advanceTimersByTimeAsync(2_000)
    const tokens = await refreshing

    expect(exchange).toHaveBeenCalledTimes(3)
    expect(tokens.refresh_token).toBe("rt_1")
    expect(readTokens()?.refresh_token).toBe("rt_1")
    expect(client.isSignedIn()).toBe(true)
    expect(cleared).not.toHaveBeenCalled()
    client.stop()
  })

  it("gives up on the attempt, not on the session, when every try fails", async () => {
    const exchange = vi.fn(async (_refreshToken: string) => ({ status: 502, body: null }))
    seed("rt_0", 3600)
    const client = new AuthClient({ exchange, jitter: () => 1, maxAttempts: 3, win: null, doc: null })

    const refreshing = client.refresh()
    const settled = expect(refreshing).rejects.toMatchObject({ code: "exhausted" })
    await vi.advanceTimersByTimeAsync(10_000)
    await settled

    expect(exchange).toHaveBeenCalledTimes(3)
    expect(readTokens()?.refresh_token).toBe("rt_0")
    expect(client.isSignedIn()).toBe(true)
  })
})

describe("invalid_grant", () => {
  it("clears the session at once and does not retry", async () => {
    const exchange = vi.fn(async (_refreshToken: string) => ({
      status: 400,
      body: { error: "invalid_grant", error_description: "refresh token is not active" },
    }))
    const cleared = vi.fn()
    seed("rt_0", 3600)
    const client = new AuthClient({ exchange, jitter: () => 1, win: null, doc: null })
    client.subscribe((tokens) => {
      if (tokens === null) cleared()
    })
    client.start()

    await expect(client.refresh()).rejects.toMatchObject({ code: "invalid_grant" })

    expect(exchange).toHaveBeenCalledTimes(1)
    expect(readTokens()).toBeNull()
    expect(client.isSignedIn()).toBe(false)
    expect(cleared).toHaveBeenCalledTimes(1)

    // No backoff timer and no re-armed schedule left behind.
    await vi.advanceTimersByTimeAsync(3_600_000)
    expect(exchange).toHaveBeenCalledTimes(1)
  })
})
