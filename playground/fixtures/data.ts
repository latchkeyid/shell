const now = Date.now()
const minutes = (n: number) => new Date(now - n * 60_000).toISOString()
const hours = (n: number) => minutes(n * 60)
const days = (n: number) => hours(n * 24)

export type IssueLevel = "fatal" | "error" | "warning" | "info"
export type IssueStatus = "unresolved" | "resolved" | "ignored"

export interface Issue {
  id: string
  title: string
  culprit: string
  level: IssueLevel
  status: IssueStatus
  events: number
  users: number
  last24h: number
  firstSeen: string
  lastSeen: string
  release: string
  env: "production" | "staging" | "development"
}

export const issues: Issue[] = [
  { id: "GRAPEVINE-MOBILE-4F2", title: "TypeError: Cannot read properties of undefined (reading 'map')", culprit: "render (app.js)", level: "error", status: "unresolved", events: 2, users: 2, last24h: 2, firstSeen: hours(5), lastSeen: minutes(3), release: "3.14.2", env: "production" },
  { id: "GRAPEVINE-BACKEND-9A1", title: "runtime.Error: assignment to entry in nil map", culprit: "github.com/GrapevineNetwork/backend/gateway.resolveJobs", level: "fatal", status: "unresolved", events: 2, users: 1, last24h: 0, firstSeen: days(2), lastSeen: days(1), release: "2026.09.10", env: "production" },
  { id: "GRAPEVINE-BACKEND-8C7", title: "*pgconn.PgError: ERROR: deadlock detected (SQLSTATE 40P01)", culprit: "processes.IssueStripeInvoice", level: "error", status: "resolved", events: 1, users: 0, last24h: 0, firstSeen: days(3), lastSeen: days(2), release: "2026.09.08", env: "production" },
  { id: "GRAPEVINE-MOBILE-3B0", title: "loom.Cutover: first issue on loom", culprit: "—", level: "warning", status: "unresolved", events: 1, users: 1, last24h: 1, firstSeen: hours(6), lastSeen: hours(6), release: "3.14.2", env: "staging" },
  { id: "GRAPEVINE-MOBILE-2E9", title: "NetworkError: The Internet connection appears to be offline.", culprit: "api/client.ts in fetchJobs", level: "warning", status: "unresolved", events: 148, users: 41, last24h: 37, firstSeen: days(12), lastSeen: minutes(18), release: "3.14.1", env: "production" },
  { id: "GRAPEVINE-WEB-1D4", title: "ChunkLoadError: Loading chunk 412 failed.", culprit: "webpack/bootstrap", level: "error", status: "ignored", events: 63, users: 22, last24h: 4, firstSeen: days(9), lastSeen: hours(2), release: "1.8.0", env: "production" },
  { id: "GRAPEVINE-BACKEND-7F3", title: "context deadline exceeded", culprit: "gateway.(*Server).ListJobs", level: "error", status: "unresolved", events: 19, users: 0, last24h: 19, firstSeen: hours(20), lastSeen: minutes(41), release: "2026.09.10", env: "production" },
  { id: "GRAPEVINE-MOBILE-6A8", title: "Warning: Each child in a list should have a unique key prop.", culprit: "JobList (JobList.tsx)", level: "info", status: "unresolved", events: 502, users: 88, last24h: 120, firstSeen: days(30), lastSeen: minutes(1), release: "3.14.2", env: "development" },
]

export interface Transaction {
  name: string
  p50: number
  p95: number
  throughput: number
}

export const transactions: Transaction[] = [
  { name: "HomeScreen", p50: 640, p95: 1200, throughput: 1820 },
  { name: "JobsScreen", p50: 900, p95: 2340, throughput: 1210 },
  { name: "Checkout", p50: 1100, p95: 5000, throughput: 402 },
  { name: "GET /api/jobs", p50: 42, p95: 180, throughput: 9800 },
]

export interface Identity {
  id: string
  email: string
  name: string
  tenant: string
  status: "active" | "suspended" | "pending"
  mfa: "passkey" | "totp" | "none"
  sessions: number
  grants: number
  lastSignIn: string | null
  created: string
  source: "password" | "google" | "saml"
}

const tenants = ["northcote-cafe", "northcote-cafe", "bayside-pm", "acme", "acme", "acme"]
const names = ["Jane Nguyen", "Priya Patel", "Tom Reilly", "Aisha Khan", "Marco Rossi", "Lena Fischer", "Ola Nowak", "Sam Okafor", "Yuki Tanaka", "Ben Carter", "Mei Chen", "Luis Ortega"]

export const identities: Identity[] = names.map((name, index) => {
  const [first, last] = name.toLowerCase().split(" ")
  const tenant = tenants[index % tenants.length]!
  return {
    id: `idn_${(0x1a2b3c + index * 7919).toString(16)}${(index * 31).toString(16).padStart(4, "0")}`,
    email: `${first}.${last}@${tenant.replace(/-/g, "")}.com`,
    name,
    tenant,
    status: index % 7 === 3 ? "suspended" : index % 5 === 4 ? "pending" : "active",
    mfa: index % 3 === 0 ? "passkey" : index % 3 === 1 ? "totp" : "none",
    sessions: (index * 3) % 5,
    grants: (index * 2) % 7,
    lastSignIn: index % 5 === 4 ? null : index % 2 ? hours(index * 5) : days(index * 3),
    created: days(30 + index * 11),
    source: index % 4 === 0 ? "saml" : index % 4 === 1 ? "google" : "password",
  }
})

export interface Run {
  id: string
  runbook: string
  service: string
  outcome: "ok" | "failed" | "skipped"
  startedBy: string
  startedAt: string
  durationMs: number
  steps: { done: number; total: number }
}

export const runs: Run[] = [
  { id: "run_01j7x2", runbook: "Rotate ingress certificates", service: "edge", outcome: "ok", startedBy: "chris", startedAt: minutes(12), durationMs: 184_000, steps: { done: 9, total: 9 } },
  { id: "run_01j7wq", runbook: "Fail over primary database", service: "postgres", outcome: "failed", startedBy: "priya", startedAt: hours(3), durationMs: 421_000, steps: { done: 4, total: 7 } },
  { id: "run_01j7vk", runbook: "Scale worker pool", service: "workers", outcome: "ok", startedBy: "scheduler", startedAt: hours(6), durationMs: 36_000, steps: { done: 3, total: 3 } },
  { id: "run_01j7u8", runbook: "Purge CDN cache", service: "edge", outcome: "skipped", startedBy: "tom", startedAt: days(1), durationMs: 0, steps: { done: 0, total: 2 } },
  { id: "run_01j7t1", runbook: "Rotate ingress certificates", service: "edge", outcome: "ok", startedBy: "scheduler", startedAt: days(7), durationMs: 190_000, steps: { done: 9, total: 9 } },
  { id: "run_01j7s9", runbook: "Restore from snapshot", service: "postgres", outcome: "ok", startedBy: "aisha", startedAt: days(12), durationMs: 2_640_000, steps: { done: 12, total: 12 } },
]

export interface Incident {
  id: string
  title: string
  severity: "sev1" | "sev2" | "sev3"
  status: "open" | "mitigated" | "resolved"
  openedAt: string
  commander: string
}

export const incidents: Incident[] = [
  { id: "INC-142", title: "Elevated 5xx on api-gateway", severity: "sev2", status: "mitigated", openedAt: hours(2), commander: "priya" },
  { id: "INC-141", title: "Delayed webhook delivery", severity: "sev3", status: "resolved", openedAt: days(1), commander: "tom" },
  { id: "INC-140", title: "Primary database failover", severity: "sev1", status: "resolved", openedAt: days(3), commander: "chris" },
]
