import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  AuthClient,
  CROSS_TAB_MESSAGE_TAG,
  parseCrossTabMessage,
  readTokens,
  writeTokens,
  type TokenEndpointResponse,
  type Tokens,
} from "@/auth/client"
import {
  createStorageChannel,
  type CrossTabChannel,
  type CrossTabHandler,
  type StorageEventLike,
  type StorageEventTarget,
} from "@/auth/cross-tab"

const NOW = new Date("2026-09-23T10:00:00Z").getTime()

function base64Url(value: object): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

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

/** A stand-in for the browser's `BroadcastChannel`: several ports on one bus,
 *  each delivering to every port but its own, and every payload structurally
 *  cloned on the way — so a test cannot pass by handing over the same object. */
function bus() {
  const handlers = new Set<CrossTabHandler>()
  return {
    port(): CrossTabChannel {
      const mine = new Set<CrossTabHandler>()
      return {
        post(payload) {
          const copy: unknown = JSON.parse(JSON.stringify(payload))
          for (const handler of handlers) if (!mine.has(handler)) handler(copy)
        },
        listen(handler) {
          handlers.add(handler)
          mine.add(handler)
          return () => {
            handlers.delete(handler)
            mine.delete(handler)
          }
        },
        close() {
          for (const handler of mine) handlers.delete(handler)
          mine.clear()
        },
      }
    },
  }
}

/** A `window` that only does `storage` events, plus the dispatch a browser
 *  would do for us in the *other* tab. */
function storageWindow() {
  const listeners = new Set<(event: StorageEventLike) => void>()
  const target: StorageEventTarget = {
    addEventListener(_type, listener) {
      listeners.add(listener)
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener)
    },
  }
  return {
    target,
    /** What the browser fires in every other tab when a key changes. */
    fire(key: string) {
      const event: StorageEventLike = { key, newValue: window.localStorage.getItem(key) }
      for (const listener of [...listeners]) listener(event)
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

describe("cross-tab coordination", () => {
  it("has the other tab adopt a rotation instead of making its own network call", async () => {
    const wire = bus()
    seed("rt_0", 3600)

    const exchangeA = vi.fn(async (_refreshToken: string) => rotated("rt_1", 3600))
    const exchangeB = vi.fn(async (_refreshToken: string) => rotated("rt_wrong", 3600))
    const tabA = new AuthClient({ exchange: exchangeA, channel: wire.port(), win: null, doc: null })
    const tabB = new AuthClient({ exchange: exchangeB, channel: wire.port(), win: null, doc: null })
    const heardByB = vi.fn()
    tabB.subscribe(heardByB)
    tabA.start()
    tabB.start()

    const fromA = await tabA.refresh()

    expect(exchangeA).toHaveBeenCalledTimes(1)
    expect(exchangeA).toHaveBeenCalledWith("rt_0")
    // The whole point: tab B never went to the token endpoint.
    expect(exchangeB).not.toHaveBeenCalled()

    expect(tabB.snapshot()?.refresh_token).toBe("rt_1")
    expect(tabB.snapshot()?.access_token).toBe(fromA.access_token)
    expect(tabB.isSignedIn()).toBe(true)
    expect(heardByB).toHaveBeenCalledTimes(1)
    expect(readTokens()?.refresh_token).toBe("rt_1")

    // B re-armed from the token it was handed — 80% of a fresh hour away, not
    // the eight minutes that were left on the one it replaced.
    await vi.advanceTimersByTimeAsync(2_000_000)
    expect(exchangeB).not.toHaveBeenCalled()

    tabA.stop()
    tabB.stop()
  })

  it("ends the session in every tab when the issuer refuses the refresh token", async () => {
    const wire = bus()
    seed("rt_0", 3600)

    const exchangeA = vi.fn(async (_refreshToken: string) => ({
      status: 400,
      body: { error: "invalid_grant" },
    }))
    const exchangeB = vi.fn(async (_refreshToken: string) => rotated("rt_wrong", 3600))
    const tabA = new AuthClient({ exchange: exchangeA, channel: wire.port(), win: null, doc: null })
    const tabB = new AuthClient({ exchange: exchangeB, channel: wire.port(), win: null, doc: null })
    tabA.start()
    tabB.start()

    await expect(tabA.refresh()).rejects.toMatchObject({ code: "invalid_grant" })

    expect(tabB.isSignedIn()).toBe(false)
    expect(tabB.snapshot()).toBeNull()
    expect(exchangeB).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(3_600_000)
    expect(exchangeB).not.toHaveBeenCalled()

    tabA.stop()
    tabB.stop()
  })

  it("does not sign anyone out when a slow call is refused after a sibling rotated", async () => {
    const wire = bus()
    seed("rt_0", 3600)

    let refuse!: (response: TokenEndpointResponse) => void
    const exchangeB = vi.fn(
      (_refreshToken: string) =>
        new Promise<TokenEndpointResponse>((resolve) => {
          refuse = resolve
        }),
    )
    const exchangeA = vi.fn(async (_refreshToken: string) => rotated("rt_1", 3600))
    const tabA = new AuthClient({ exchange: exchangeA, channel: wire.port(), win: null, doc: null })
    const tabB = new AuthClient({ exchange: exchangeB, channel: wire.port(), win: null, doc: null })
    tabA.start()
    tabB.start()

    // B presents rt_0 and its request stalls; A rotates rt_0 away underneath it.
    const slow = tabB.refresh()
    expect(exchangeB).toHaveBeenCalledWith("rt_0")
    await tabA.refresh()
    expect(tabB.snapshot()?.refresh_token).toBe("rt_1")

    // The issuer then refuses rt_0 — correctly, it is spent. That is an answer
    // about a token, not about the session, and B keeps the one it adopted.
    refuse({ status: 400, body: { error: "invalid_grant" } })

    await expect(slow).resolves.toMatchObject({ refresh_token: "rt_1" })
    expect(tabB.isSignedIn()).toBe(true)
    expect(tabA.isSignedIn()).toBe(true)
    expect(readTokens()?.refresh_token).toBe("rt_1")

    tabA.stop()
    tabB.stop()
  })

  it("ignores a foreign or malformed message rather than adopting it", () => {
    const wire = bus()
    seed("rt_0", 3600)
    const exchange = vi.fn(async (_refreshToken: string) => rotated("rt_wrong", 3600))
    const speaker = wire.port()
    const tab = new AuthClient({ exchange, channel: wire.port(), win: null, doc: null })
    tab.start()

    speaker.post({ type: "rotated", tokens: { access_token: "a", refresh_token: "rt_evil", expires_at: 1 } })
    speaker.post({ tag: "some.other.app/1", type: "rotated", tokens: { access_token: "a", refresh_token: "rt_evil", expires_at: 1 } })
    speaker.post({ tag: CROSS_TAB_MESSAGE_TAG, type: "rotated", tokens: { refresh_token: "rt_evil" } })
    speaker.post({ tag: CROSS_TAB_MESSAGE_TAG, type: "shrug" })
    speaker.post("rt_evil")

    expect(tab.snapshot()?.refresh_token).toBe("rt_0")
    expect(parseCrossTabMessage(null)).toBeNull()
    expect(parseCrossTabMessage({ tag: CROSS_TAB_MESSAGE_TAG, type: "ended" })).toEqual({
      tag: CROSS_TAB_MESSAGE_TAG,
      type: "ended",
    })

    tab.stop()
  })

  it("stops listening once the client is stopped", async () => {
    const wire = bus()
    seed("rt_0", 3600)
    const tabA = new AuthClient({
      exchange: async () => rotated("rt_1", 3600),
      channel: wire.port(),
      win: null,
      doc: null,
    })
    const tabB = new AuthClient({ exchange: vi.fn(), channel: wire.port(), win: null, doc: null })
    tabA.start()
    tabB.start()
    tabB.stop()

    await tabA.refresh()

    expect(tabB.snapshot()?.refresh_token).toBe("rt_0")
    tabA.stop()
  })
})

describe("the storage-event fallback", () => {
  it("carries a rotation to a tab that has no BroadcastChannel", async () => {
    // One localStorage, one `storage` event bus — two tabs of the same origin
    // in a browser where `BroadcastChannel` is not there to be had.
    const browser = storageWindow()
    const key = "latchkey.tokens.sync"
    seed("rt_0", 3600)

    const exchangeA = vi.fn(async (_refreshToken: string) => rotated("rt_1", 3600))
    const exchangeB = vi.fn(async (_refreshToken: string) => rotated("rt_wrong", 3600))
    // Tab A only writes; tab B only listens, as the real event's asymmetry has it.
    const tabA = new AuthClient({
      exchange: exchangeA,
      channel: createStorageChannel(key, null),
      win: null,
      doc: null,
    })
    const tabB = new AuthClient({
      exchange: exchangeB,
      channel: createStorageChannel(key, browser.target),
      win: null,
      doc: null,
    })
    tabA.start()
    tabB.start()

    await tabA.refresh()
    expect(window.localStorage.getItem(key)).toContain("rt_1")

    browser.fire(key)

    expect(tabB.snapshot()?.refresh_token).toBe("rt_1")
    expect(exchangeB).not.toHaveBeenCalled()

    tabA.stop()
    tabB.stop()
  })

  it("shrugs off an unrelated key, a cleared value and an unparseable one", () => {
    const browser = storageWindow()
    const key = "latchkey.tokens.sync"
    const heard = vi.fn()
    const channel = createStorageChannel(key, browser.target)
    const stop = channel.listen(heard)

    window.localStorage.setItem("something.else", "{}")
    browser.fire("something.else")
    window.localStorage.setItem(key, "not json")
    browser.fire(key)
    window.localStorage.removeItem(key)
    browser.fire(key)
    expect(heard).not.toHaveBeenCalled()

    channel.post({ tag: CROSS_TAB_MESSAGE_TAG, type: "ended" })
    browser.fire(key)
    expect(heard).toHaveBeenCalledWith({ tag: CROSS_TAB_MESSAGE_TAG, type: "ended" })

    stop()
    channel.post({ tag: CROSS_TAB_MESSAGE_TAG, type: "ended" })
    browser.fire(key)
    expect(heard).toHaveBeenCalledTimes(1)
    channel.close()
  })

  it("survives having no window to listen on at all", () => {
    const channel = createStorageChannel("latchkey.tokens.sync", null)
    expect(() => channel.listen(vi.fn())()).not.toThrow()
    expect(() => channel.post({ tag: CROSS_TAB_MESSAGE_TAG, type: "ended" })).not.toThrow()
    expect(() => channel.close()).not.toThrow()
  })
})
