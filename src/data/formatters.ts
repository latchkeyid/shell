/** Shared formatters: relative times within 7 days then absolute, tabular numbers, "—" for empty. */

export const EMPTY = "—"

const DAY = 86_400_000
const RELATIVE_WINDOW = 7 * DAY

export type DateInput = Date | string | number | null | undefined

function toDate(input: DateInput): Date | undefined {
  if (input == null || input === "") return undefined
  const date = input instanceof Date ? input : new Date(input)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/** "just now", "5m ago", "3h ago", "2d ago", "in 4h"; beyond 7 days "Mar 14, 2026". */
export function formatTime(input: DateInput, now: DateInput = new Date(), locale?: string): string {
  const date = toDate(input)
  if (!date) return EMPTY
  const reference = toDate(now) ?? new Date()
  const diff = date.getTime() - reference.getTime()
  const abs = Math.abs(diff)
  if (abs >= RELATIVE_WINDOW) return formatDate(date, locale)
  const past = diff <= 0
  const wrap = (value: string) => (past ? `${value} ago` : `in ${value}`)
  if (abs < 45_000) return past ? "just now" : "in a moment"
  const minutes = Math.round(abs / 60_000)
  if (minutes < 60) return wrap(`${minutes}m`)
  const hours = Math.round(abs / 3_600_000)
  if (hours < 24) return wrap(`${hours}h`)
  const days = Math.round(abs / DAY)
  return wrap(`${days}d`)
}

/** "Mar 14, 2026". Year is dropped when it is the current one and `alwaysYear` is false. */
export function formatDate(input: DateInput, locale?: string, alwaysYear = true): string {
  const date = toDate(input)
  if (!date) return EMPTY
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: alwaysYear || date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  }).format(date)
}

/** "Mar 14, 2026, 09:41" in the user's locale. */
export function formatDateTime(input: DateInput, locale?: string): string {
  const date = toDate(input)
  if (!date) return EMPTY
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

/** ISO 8601, for tooltips and `<time dateTime>`. */
export function formatIso(input: DateInput): string {
  const date = toDate(input)
  return date ? date.toISOString() : ""
}

/** 1234567 → "1,234,567"; null → "—". */
export function formatNumber(value: number | null | undefined, locale?: string, options?: Intl.NumberFormatOptions): string {
  if (value == null || Number.isNaN(value)) return EMPTY
  return new Intl.NumberFormat(locale, options).format(value)
}

/** 1234 → "1.2k", 1_250_000 → "1.3M". */
export function formatCompact(value: number | null | undefined, locale?: string): string {
  if (value == null || Number.isNaN(value)) return EMPTY
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

/** 0.1234 → "12.3%". */
export function formatPercent(value: number | null | undefined, digits = 1, locale?: string): string {
  if (value == null || Number.isNaN(value)) return EMPTY
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: digits }).format(value)
}

/** Milliseconds → "640 ms", "1.20 s", "2m 05s". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return EMPTY
  if (ms < 1) return `${ms.toFixed(2)} ms`
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  if (minutes < 60) return `${minutes}m ${String(seconds).padStart(2, "0")}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`
}

/** 1536 → "1.5 KB". */
export function formatBytes(bytes: number | null | undefined, digits = 1): string {
  if (bytes == null || Number.isNaN(bytes)) return EMPTY
  const units = ["B", "KB", "MB", "GB", "TB"]
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${unit === 0 ? value : value.toFixed(digits)} ${units[unit]}`
}

/** Cursor paging copy: "21–40 of 142". */
export function formatRange(from: number, to: number, total?: number | null): string {
  if (total == null) return `${from}–${to}`
  if (total === 0) return "0 of 0"
  return `${from}–${Math.min(to, total)} of ${formatNumber(total)}`
}

/** Renders "—" for null, undefined and empty strings; passes everything else through. */
export function formatEmpty<T>(value: T): T | typeof EMPTY {
  if (value == null) return EMPTY
  if (typeof value === "string" && value.trim() === "") return EMPTY
  return value
}

/** Shorten an identifier for display: "a1b2c3d4-…-ef56". */
export function truncateId(id: string, head = 8, tail = 4): string {
  if (id.length <= head + tail + 1) return id
  return `${id.slice(0, head)}…${id.slice(-tail)}`
}
