// @latchkey/shell — one theme and one app shell for the latchkey consoles.
//
// Theme CSS is imported separately:
//   @import "@latchkey/shell/theme/base.css";
//   @import "@latchkey/shell/theme/tripline.css";

// Shell
export { AppShell, SIDEBAR_COOKIE, type AppShellProps } from "@/shell/app-shell"
export { AppSidebar, findActiveItem, type AppSidebarProps } from "@/shell/sidebar-nav"
export {
  OrgSwitcher,
  SwitcherPanel,
  StaffCountdown,
  canSwitchOrgs,
  computeSections,
  minutesLeft,
  recentOrgsKey,
  resolveCurrentScope,
  INITIAL_ROWS,
  RENDER_CAP,
  SEARCH_HINT_THRESHOLD,
  type CurrentScope,
  type SwitcherSections,
} from "@/shell/org-switcher"
export { OrgAvatar, type OrgAvatarProps } from "@/shell/org-avatar"
export { PageActionBar, PageTitle, type Crumb, type PageActionBarProps } from "@/shell/page-action-bar"
export { ScopeChain } from "@/shell/scope-chain"
export { ScopePicker, type ScopePickerProps } from "@/shell/scope-picker"
export { AccountMenu } from "@/shell/account-menu"
export { StaffBanner } from "@/shell/staff-banner"
export { CommandPalette, GROUPING_THRESHOLD, filterCommands, internalPath } from "@/shell/command-palette"
export { ThemeProvider, useTheme, useResolvedTheme, type ResolvedTheme, type ThemeProviderProps } from "@/shell/theme-provider"
export {
  CHORD_WINDOW_MS,
  hasOpenDialog,
  isEditableTarget,
  parseHotkey,
  useChord,
  useHotkey,
  type HotkeyOptions,
} from "@/shell/hotkeys"
export { LiveRegionProvider, focusPageHeading, useAnnounce } from "@/shell/live-region"
export { ShellLink, AnchorLink } from "@/shell/link"
export { useShell, useShellOptional, useCommands, type PickerRequest, type ShellContextValue } from "@/shell/shell-context"
export { usePins, useRecentNav, pinsKey, recentNavKey, MAX_RECENT_NAV } from "@/shell/pins"
export { WelcomePage, type WelcomePageProps } from "@/shell/welcome"
export { NotAMemberPage, type NotAMemberPageProps } from "@/shell/not-a-member"
export {
  defaultPaths,
  type CommandItem,
  type CommandRegistry,
  type EnvironmentConfig,
  type EnvironmentOption,
  type IconComponent,
  type LinkComponent,
  type LinkProps,
  type NavGroup,
  type NavItem,
  type OrgRole,
  type ScopeConfig,
  type ScopeItem,
  type ShellApp,
  type ShellCallbacks,
  type ShellInvitation,
  type ShellOrg,
  type ShellPaths,
  type ShellSession,
  type ShellUser,
  type StaffActAs,
  type ThemeMode,
} from "@/shell/types"

// Data
export {
  DataTable,
  ViewOptions,
  createColumns,
  dataTableFeatures,
  type DataTableColumn,
  type DataTableColumnMeta,
  type DataTableFeatures,
  type DataTablePagination,
  type DataTableProps,
  type DataTableRow,
} from "@/data/data-table"
export {
  densities,
  densityKey,
  densityLabels,
  densityRowHeight,
  isDensity,
  useDensity,
  type Density,
} from "@/data/density"
export { ListRow, ListRows, type ListRowProps } from "@/data/list-row"
export { StatusDot, type StatusDotProps, type StatusTone } from "@/data/status-dot"
export { Level, type LevelProps, type LevelValue } from "@/data/level"
export { Id, type IdProps } from "@/data/id"
export { EmptyState, type EmptyStateProps, type EmptyStateVariant } from "@/data/empty-state"
export { Metric, type MetricProps } from "@/data/metric"
export {
  DetailSheet,
  DETAIL_SHEET_MAX,
  DETAIL_SHEET_MIN,
  clampSheetWidth,
  readPanelParam,
  withPanelParam,
  type DetailSheetProps,
} from "@/data/detail-sheet"
export {
  EMPTY,
  formatBytes,
  formatCompact,
  formatDate,
  formatDateTime,
  formatDuration,
  formatEmpty,
  formatIso,
  formatNumber,
  formatPercent,
  formatRange,
  formatTime,
  truncateId,
  type DateInput,
} from "@/data/formatters"

// Actions
export { ConfirmDialog, type ConfirmDialogProps } from "@/actions/confirm-dialog"
export { useOptimisticAction, type OptimisticAction, type OptimisticActionOptions } from "@/actions/use-optimistic-action"
export { toast, toastSaved, toastUndo, UNDO_TOAST_MS, type UndoToastOptions } from "@/actions/toast"
export { InlineMessage, type InlineMessageProps, type InlineMessageTone } from "@/actions/inline-message"
export { SaveIndicator, useSaveState, type SaveIndicatorProps, type SaveState } from "@/actions/save-indicator"

// Utilities
export { cn } from "@/lib/utils"
export { initials, roleLabel, isMac, modKeyLabel } from "@/lib/text"
export { readJson, writeJson, removeKey, readCookie } from "@/lib/storage"
export { useIsMobile } from "@/hooks/use-mobile"

// shadcn/ui primitives
export * from "@/components/ui/avatar"
export * from "@/components/ui/badge"
export * from "@/components/ui/breadcrumb"
export * from "@/components/ui/button"
export * from "@/components/ui/card"
export * from "@/components/ui/checkbox"
export * from "@/components/ui/command"
export * from "@/components/ui/dialog"
export * from "@/components/ui/dropdown-menu"
export * from "@/components/ui/input"
export * from "@/components/ui/input-group"
export * from "@/components/ui/kbd"
export * from "@/components/ui/label"
export * from "@/components/ui/popover"
export * from "@/components/ui/progress"
export * from "@/components/ui/scroll-area"
export * from "@/components/ui/select"
export * from "@/components/ui/separator"
export * from "@/components/ui/sheet"
export * from "@/components/ui/sidebar"
export * from "@/components/ui/skeleton"
export * from "@/components/ui/sonner"
export * from "@/components/ui/table"
export * from "@/components/ui/tabs"
export * from "@/components/ui/textarea"
export * from "@/components/ui/tooltip"
