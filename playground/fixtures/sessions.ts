import type { ShellOrg, ShellSession } from "@/shell/types"

const user = {
  id: "u_chris",
  email: "chris@grapevine.network",
  name: "Chris Kolenko",
}

const grapevine: ShellOrg = { slug: "grapevine", name: "grapevine", role: "owner" }
const runsheet: ShellOrg = { slug: "runsheet", name: "runsheet", role: "admin" }
const optrader: ShellOrg = { slug: "optrader", name: "optrader", role: "member" }
const latchkey: ShellOrg = { slug: "latchkey", name: "latchkey", role: "owner" }
const bayside: ShellOrg = { slug: "bayside-pm", name: "bayside-pm", role: "viewer", suspended: true }

export const multiOrg: ShellSession = {
  user,
  orgs: [grapevine, runsheet, optrader, bayside],
  currentOrg: "grapevine",
  invitations: [
    { id: "inv_1", orgSlug: "northside-plumbing", orgName: "Northside Plumbing", invitedBy: "jane@northside.com.au", role: "admin" },
  ],
  canCreateOrg: true,
  staff: false,
  recentOrgs: ["runsheet", "optrader"],
}

export const singleOrg: ShellSession = {
  user,
  orgs: [grapevine],
  currentOrg: "grapevine",
  invitations: [],
  canCreateOrg: false,
  staff: false,
}

export const zeroOrg: ShellSession = {
  user,
  orgs: [],
  invitations: [
    { id: "inv_2", orgSlug: "bayside-pm", orgName: "bayside-pm", invitedBy: "jane@bayside-pm.com.au", role: "admin" },
  ],
  canCreateOrg: true,
  staff: false,
}

export const staffViewAs: ShellSession = {
  user: { ...user, email: "chris@latchkey.id" },
  orgs: [latchkey],
  currentOrg: "latchkey",
  invitations: [],
  canCreateOrg: true,
  staff: true,
  actAs: {
    org: "northcote-cafe",
    reason: "support ticket #4821",
    expiresAt: new Date(Date.now() + 52 * 60_000).toISOString(),
  },
}

const words = [
  "acme", "globex", "initech", "umbrella", "hooli", "vandelay", "stark", "wayne", "wonka", "tyrell",
  "cyberdyne", "aperture", "massive", "soylent", "oscorp", "gringotts", "pied-piper", "dunder", "sterling", "prestige",
  "bluth", "monarch", "nakatomi", "weyland", "zorg", "octan", "virtucon", "gekko", "duff", "krusty",
]

export const sixtyOrgs: ShellSession = {
  user,
  orgs: [
    grapevine,
    ...Array.from({ length: 59 }, (_, index) => {
      const base = words[index % words.length]!
      const suffix = Math.floor(index / words.length) ? `-${Math.floor(index / words.length) + 1}` : ""
      const roles: ShellOrg["role"][] = ["owner", "admin", "member", "viewer"]
      return { slug: `${base}${suffix}`, name: `${base}${suffix}`, role: roles[index % 4]! }
    }),
  ],
  currentOrg: "grapevine",
  invitations: [],
  canCreateOrg: true,
  staff: false,
  recentOrgs: ["hooli", "wonka", "stark"],
}

export const sessions = {
  multi: { label: "Multi-org", session: multiOrg },
  single: { label: "Single org", session: singleOrg },
  zero: { label: "Zero orgs", session: zeroOrg },
  staff: { label: "Staff view-as", session: staffViewAs },
  sixty: { label: "60 orgs", session: sixtyOrgs },
} as const

export type SessionKey = keyof typeof sessions

/** Platform directory search used by the staff fixture. */
export async function searchPlatformOrgs(query: string, signal: AbortSignal) {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 300)
    signal.addEventListener("abort", () => {
      clearTimeout(timer)
      reject(new DOMException("Aborted", "AbortError"))
    })
  })
  const directory = [
    { slug: "northcote-cafe", name: "Northcote Cafe" },
    { slug: "northside-plumbing", name: "Northside Plumbing" },
    { slug: "north-melbourne-fc", name: "North Melbourne FC" },
    { slug: "latchkey", name: "latchkey" },
  ]
  const q = query.toLowerCase()
  return directory.filter((org) => org.name.toLowerCase().includes(q) || org.slug.includes(q))
}
