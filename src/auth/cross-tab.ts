/** Transport for the one thing open tabs of the same app must agree on: which
 *  refresh token is the current one.
 *
 *  Five tabs each running their own schedule would each rotate, and each
 *  rotation invalidates the last — four of them saved only by the issuer's
 *  reuse grace window. So the tab that rotates tells the others, and they adopt
 *  the result instead of calling the token endpoint themselves.
 *
 *  Two transports, in order of preference: `BroadcastChannel` where it exists,
 *  and otherwise a `storage` event — every browser that has `localStorage` at
 *  all fires one in the *other* tabs when a key changes. Neither is assumed to
 *  be there: as in `lib/storage.ts`, every touch of a browser API is guarded,
 *  so a private window, a worker, SSR or blocked storage degrades to a channel
 *  that carries nothing rather than throwing on construction. */

/** What the channel carries is the client's business, not the transport's: a
 *  payload goes out as JSON and comes back in as `unknown`, for the receiver to
 *  validate. It crosses a process boundary — it is not to be trusted. */
export type CrossTabHandler = (payload: unknown) => void

export interface CrossTabChannel {
  /** Send to every *other* tab. Never to the sender itself. */
  post(payload: unknown): void
  /** Returns the unsubscribe. */
  listen(handler: CrossTabHandler): () => void
  close(): void
}

/** The slice of `StorageEvent` the fallback reads. */
export interface StorageEventLike {
  key: string | null
  newValue: string | null
}

/** The slice of `window` the fallback listens on, narrowed so a test — or a
 *  worker, or SSR — can pass a stub or null. */
export interface StorageEventTarget {
  addEventListener(type: "storage", listener: (event: StorageEventLike) => void): void
  removeEventListener(type: "storage", listener: (event: StorageEventLike) => void): void
}

/** A channel that drops everything: the shape returned when no transport is
 *  available, so callers never branch on null. */
export function createNullChannel(): CrossTabChannel {
  return {
    post() {},
    listen() {
      return () => {}
    },
    close() {},
  }
}

/** A `BroadcastChannel`, or null where the constructor is missing or throws.
 *  `BroadcastChannel` does not deliver to the sender, which is what we want. */
export function createBroadcastChannel(name: string): CrossTabChannel | null {
  const ctor = globalThis.BroadcastChannel
  if (typeof ctor !== "function") return null
  let channel: BroadcastChannel
  try {
    channel = new ctor(name)
  } catch {
    return null
  }
  return {
    post(payload) {
      try {
        channel.postMessage(payload)
      } catch {
        /* an unstructured-cloneable payload, or a closed channel */
      }
    },
    listen(handler) {
      const onMessage = (event: MessageEvent): void => handler(event.data)
      channel.addEventListener("message", onMessage as EventListener)
      return () => channel.removeEventListener("message", onMessage as EventListener)
    },
    close() {
      try {
        channel.close()
      } catch {
        /* already closed */
      }
    },
  }
}

/** The fallback: write the payload to a `localStorage` key, and read the
 *  `storage` events other tabs get for it. The key is written, never read back
 *  — it is a wire, not a store; the tokens themselves live under their own key.
 *
 *  Every message carries a nonce because `storage` only fires when the value
 *  actually changes, and two rotations can otherwise serialise identically. */
export function createStorageChannel(name: string, win?: StorageEventTarget | null): CrossTabChannel {
  const target = win === undefined ? ((globalThis.window as StorageEventTarget | undefined) ?? null) : win
  let seq = 0
  return {
    post(payload) {
      seq += 1
      try {
        globalThis.localStorage?.setItem(name, JSON.stringify({ seq, at: Date.now(), payload }))
      } catch {
        /* storage unavailable */
      }
    },
    listen(handler) {
      if (!target) return () => {}
      const onStorage = (event: StorageEventLike): void => {
        if (event.key !== name || event.newValue == null) return
        let envelope: unknown
        try {
          envelope = JSON.parse(event.newValue)
        } catch {
          return
        }
        if (typeof envelope !== "object" || envelope === null) return
        handler((envelope as { payload?: unknown }).payload)
      }
      target.addEventListener("storage", onStorage)
      return () => target.removeEventListener("storage", onStorage)
    },
    close() {},
  }
}

export interface CrossTabChannelOptions {
  /** Listener target for the `storage` fallback. Defaults to `window`. */
  win?: StorageEventTarget | null
}

/** `BroadcastChannel` where it exists, the `storage` event where it does not. */
export function createCrossTabChannel(name: string, options: CrossTabChannelOptions = {}): CrossTabChannel {
  return createBroadcastChannel(name) ?? createStorageChannel(name, options.win)
}
