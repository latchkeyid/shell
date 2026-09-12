import { LockIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/data/empty-state"

export interface NotAMemberPageProps {
  orgName: string
  /** Platform staff see a "View as staff" action. */
  staff?: boolean
  onViewAsStaff?: () => void
  onSwitch?: () => void
}

/** 403 for an org URL the user is not a member of. Mount inside AppShell so the switcher stays. */
export function NotAMemberPage({ orgName, staff = false, onViewAsStaff, onSwitch }: NotAMemberPageProps) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <EmptyState
        variant="permission"
        icon={LockIcon}
        title={`You are not a member of ${orgName}`}
        description="Ask an organisation admin for an invitation, or switch to one of your organisations."
        action={
          <div className="flex gap-2">
            {onSwitch && (
              <Button size="sm" variant="outline" onClick={onSwitch}>
                Switch organisation
              </Button>
            )}
            {staff && onViewAsStaff && (
              <Button size="sm" onClick={onViewAsStaff}>
                View as staff
              </Button>
            )}
          </div>
        }
      />
    </main>
  )
}
