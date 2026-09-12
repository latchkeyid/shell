import { describe, expect, it } from "vitest"

import {
  EMPTY,
  formatBytes,
  formatCompact,
  formatDate,
  formatDuration,
  formatEmpty,
  formatNumber,
  formatRange,
  formatTime,
  truncateId,
} from "@/data/formatters"

const now = new Date("2026-09-12T10:00:00Z")

describe("formatTime", () => {
  it("is relative inside seven days", () => {
    expect(formatTime(new Date(now.getTime() - 20_000), now)).toBe("just now")
    expect(formatTime(new Date(now.getTime() - 3 * 60_000), now)).toBe("3m ago")
    expect(formatTime(new Date(now.getTime() - 5 * 3_600_000), now)).toBe("5h ago")
    expect(formatTime(new Date(now.getTime() - 2 * 86_400_000), now)).toBe("2d ago")
    expect(formatTime(new Date(now.getTime() + 4 * 3_600_000), now)).toBe("in 4h")
  })

  it("switches to an absolute date at seven days", () => {
    const eightDays = new Date(now.getTime() - 8 * 86_400_000)
    expect(formatTime(eightDays, now, "en-US")).toBe("Sep 4, 2026")
    expect(formatTime(new Date(now.getTime() - 6 * 86_400_000 - 23 * 3_600_000), now)).toBe("7d ago")
  })

  it("renders the em dash for missing and invalid input", () => {
    expect(formatTime(null, now)).toBe(EMPTY)
    expect(formatTime("not a date", now)).toBe(EMPTY)
    expect(formatDate(undefined)).toBe(EMPTY)
  })
})

describe("numbers", () => {
  it("formats with tabular grouping and compact notation", () => {
    expect(formatNumber(1234567, "en-US")).toBe("1,234,567")
    expect(formatNumber(null)).toBe(EMPTY)
    expect(formatCompact(1250, "en-US")).toBe("1.3K")
  })

  it("formats durations from ms to hours", () => {
    expect(formatDuration(640)).toBe("640 ms")
    expect(formatDuration(1200)).toBe("1.20 s")
    expect(formatDuration(125_000)).toBe("2m 05s")
    expect(formatDuration(3_720_000)).toBe("1h 02m")
    expect(formatDuration(undefined)).toBe(EMPTY)
  })

  it("formats bytes", () => {
    expect(formatBytes(512)).toBe("512 B")
    expect(formatBytes(1536)).toBe("1.5 KB")
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB")
  })
})

describe("copy helpers", () => {
  it("formats cursor paging ranges", () => {
    expect(formatRange(21, 40, 142)).toBe("21–40 of 142")
    expect(formatRange(141, 160, 142)).toBe("141–142 of 142")
    expect(formatRange(1, 25)).toBe("1–25")
    expect(formatRange(0, 0, 0)).toBe("0 of 0")
  })

  it("renders the em dash for empty values only", () => {
    expect(formatEmpty(null)).toBe(EMPTY)
    expect(formatEmpty("  ")).toBe(EMPTY)
    expect(formatEmpty(0)).toBe(0)
    expect(formatEmpty("ok")).toBe("ok")
  })

  it("truncates identifiers with head and tail", () => {
    expect(truncateId("a1b2c3d4e5f6a7b8c9d0")).toBe("a1b2c3d4…c9d0")
    expect(truncateId("short")).toBe("short")
  })
})
