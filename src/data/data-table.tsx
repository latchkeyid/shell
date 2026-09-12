import * as React from "react"
import {
  columnPinningFeature,
  columnSizingFeature,
  createColumnHelper,
  createSortedRowModel,
  FlexRender,
  flexRender,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
  type Cell,
  type Column,
  type ColumnDef,
  type ColumnPinningState,
  type Header,
  type Row,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type TableOptions,
} from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon, ChevronsUpDownIcon, Settings2Icon } from "lucide-react"

import { Button } from "../components/ui/button"
import { Checkbox } from "../components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { cn } from "../lib/utils"
import { densities, densityLabels, useDensity, type Density } from "./density"
import { EmptyState } from "./empty-state"
import { EMPTY, formatEmpty, formatRange } from "./formatters"

/** Per-column presentation hints, declared via `meta` on a column def. */
export interface DataTableColumnMeta {
  /** Right-align and use tabular numerals (header included). */
  numeric?: boolean
  /** Render in mono. */
  mono?: boolean
  /** Extra classes for header and cells. */
  className?: string
  /** Extra classes for cells only. */
  cellClassName?: string
}

export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
  columnSizingFeature,
  columnPinningFeature,
  rowSelectionFeature,
  columnMeta: {} as DataTableColumnMeta,
})

export type DataTableFeatures = typeof dataTableFeatures
export type DataTableColumn<TData extends RowData, TValue = unknown> = ColumnDef<DataTableFeatures, TData, TValue>
export type DataTableRow<TData extends RowData> = Row<DataTableFeatures, TData>

/** Typed column helper bound to the DataTable feature set. */
export function createColumns<TData extends RowData>() {
  return createColumnHelper<DataTableFeatures, TData>()
}

export interface DataTablePagination {
  /** 1-based index of the first row on this page. */
  from: number
  /** 1-based index of the last row on this page. */
  to: number
  total?: number | null
  pageSize: number
  pageSizes?: number[]
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onPageSize?: (size: number) => void
}

export interface DataTableProps<TData extends RowData> {
  columns: DataTableColumn<TData, any>[]
  data: TData[]
  getRowId?: (row: TData, index: number) => string
  /** Persist the chosen density under this key (usually the route). */
  densityKey?: string
  defaultDensity?: Density
  /** Controlled density; disables the view-options radio. */
  density?: Density
  /** Sticky header inside the table's own scroll container. Default true. */
  stickyHeader?: boolean
  /** Pin the first column (identifier) to the start. */
  pinFirstColumn?: boolean
  /** Pin the last column (row actions) to the end. */
  pinLastColumn?: boolean
  /** Adds a checkbox selection column. */
  selectable?: boolean
  rowSelection?: RowSelectionState
  onRowSelectionChange?: (next: RowSelectionState) => void
  sorting?: SortingState
  onSortingChange?: (next: SortingState) => void
  /** Rows the table trusts as already sorted (server sort). */
  manualSorting?: boolean
  /** Highlight this row as selected (detail sheet). */
  activeRowId?: string
  onRowClick?: (row: TData) => void
  /** Adds a subtle danger tint to a row. */
  rowTone?: (row: TData) => "danger" | "warning" | undefined
  pagination?: DataTablePagination
  /** Live streams: rows waiting behind an "N new" pill. */
  newCount?: number
  onShowNew?: () => void
  /** Controls left of the view options menu. */
  toolbar?: React.ReactNode
  /** Hide the density menu row entirely. */
  hideViewOptions?: boolean
  emptyState?: React.ReactNode
  /** Max height of the scroll container, e.g. "60vh". */
  maxHeight?: string
  caption?: string
  className?: string
}

const EMPTY_ROWS: never[] = []

export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  densityKey,
  defaultDensity = "normal",
  density: controlledDensity,
  stickyHeader = true,
  pinFirstColumn = false,
  pinLastColumn = false,
  selectable = false,
  rowSelection,
  onRowSelectionChange,
  sorting,
  onSortingChange,
  manualSorting = false,
  activeRowId,
  onRowClick,
  rowTone,
  pagination,
  newCount = 0,
  onShowNew,
  toolbar,
  hideViewOptions = false,
  emptyState,
  maxHeight,
  caption,
  className,
}: DataTableProps<TData>) {
  const [storedDensity, setDensity] = useDensity(densityKey, defaultDensity)
  const density = controlledDensity ?? storedDensity

  const allColumns = React.useMemo<DataTableColumn<TData, any>[]>(() => {
    if (!selectable) return columns
    const select: DataTableColumn<TData, unknown> = {
      id: "__select",
      size: 32,
      enableSorting: false,
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all rows"
          checked={table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? "indeterminate" : false}
          onCheckedChange={(value) => table.toggleAllRowsSelected(value === true)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Select row"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onClick={(event) => {
            event.stopPropagation()
            row.getToggleSelectedHandler()(event)
          }}
        />
      ),
    }
    return [select, ...columns]
  }, [columns, selectable])

  const columnPinning = React.useMemo<ColumnPinningState>(() => {
    const ids = allColumns.map((column, index) => column.id ?? ("accessorKey" in column ? String(column.accessorKey) : `${index}`))
    const start: string[] = []
    const end: string[] = []
    if (selectable && ids[0]) start.push(ids[0])
    if (pinFirstColumn) {
      const first = ids[selectable ? 1 : 0]
      if (first) start.push(first)
    }
    if (pinLastColumn) {
      const last = ids[ids.length - 1]
      if (last && !start.includes(last)) end.push(last)
    }
    return { start, end }
  }, [allColumns, pinFirstColumn, pinLastColumn, selectable])

  const [internalSorting, setInternalSorting] = React.useState<SortingState>([])
  const [internalSelection, setInternalSelection] = React.useState<RowSelectionState>({})

  const options: TableOptions<DataTableFeatures, TData> = {
    features: dataTableFeatures,
    columns: allColumns,
    data: data.length ? data : EMPTY_ROWS,
    getRowId,
    manualSorting,
    enableRowSelection: selectable,
    enableColumnPinning: true,
    defaultColumn: {
      cell: ({ getValue }) => formatEmpty(getValue() as React.ReactNode),
      minSize: 40,
    },
    state: {
      sorting: sorting ?? internalSorting,
      rowSelection: rowSelection ?? internalSelection,
      columnPinning,
    },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting ?? internalSorting) : updater
      setInternalSorting(next)
      onSortingChange?.(next)
    },
    onRowSelectionChange: (updater) => {
      const next = typeof updater === "function" ? updater(rowSelection ?? internalSelection) : updater
      setInternalSelection(next)
      onRowSelectionChange?.(next)
    },
  }
  const table = useTable(options)

  const rows = table.getRowModel().rows
  const hasPinned = columnPinning.start.length > 0 || columnPinning.end.length > 0

  return (
    <div data-slot="data-table" data-density={density} className={cn("flex min-w-0 flex-col gap-2", className)}>
      {(toolbar || !hideViewOptions || newCount > 0) && (
        <div className="flex min-h-8 items-center gap-2">
          {toolbar}
          {newCount > 0 && (
            <Button size="xs" variant="secondary" onClick={onShowNew} className="gap-1 rounded-full">
              <ChevronDownIcon className="size-3" aria-hidden="true" />
              {newCount} new
            </Button>
          )}
          {!hideViewOptions && (
            <div className="ml-auto">
              <ViewOptions density={density} onDensity={controlledDensity ? undefined : setDensity} />
            </div>
          )}
        </div>
      )}

      <div
        data-slot="data-table-scroll"
        className="relative overflow-auto rounded-lg border bg-card"
        style={{ maxHeight }}
      >
        <Table className="w-full border-separate border-spacing-0">
          {caption && <caption className="sr-only">{caption}</caption>}
          <TableHeader className={cn(stickyHeader && "sticky top-0 z-(--z-table-header)")}>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <HeaderCell key={header.id} header={header} pinned={hasPinned} />
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={allColumns.length} className="p-0">
                  {emptyState ?? <EmptyState variant="no-results" size="sm" />}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const active = activeRowId != null && row.id === activeRowId
                const selected = row.getIsSelected()
                const tone = rowTone?.(row.original)
                return (
                  <TableRow
                    key={row.id}
                    data-state={active || selected ? "selected" : undefined}
                    data-tone={tone}
                    aria-selected={selectable ? selected : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (event.key === "Enter" && event.target === event.currentTarget) onRowClick(row.original)
                          }
                        : undefined
                    }
                    className={cn(
                      "group/row border-0 outline-none hover:bg-row-hover focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]",
                      onRowClick && "cursor-pointer",
                      tone === "danger" && "[&>td:first-child]:shadow-[inset_2px_0_0_var(--destructive)]",
                      tone === "warning" && "[&>td:first-child]:shadow-[inset_2px_0_0_var(--warning)]",
                    )}
                  >
                    {row.getAllCells().map((cell) => (
                      <BodyCell key={cell.id} cell={cell} pinned={hasPinned} />
                    ))}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && <PaginationBar {...pagination} />}
    </div>
  )
}

function pinStyle<TData extends RowData>(column: Column<DataTableFeatures, TData, unknown>, enabled: boolean): React.CSSProperties {
  const pinned = column.getIsPinned()
  if (!enabled || !pinned) return {}
  return {
    position: "sticky",
    insetInlineStart: pinned === "start" ? `${column.getStart("start")}px` : undefined,
    insetInlineEnd: pinned === "end" ? `${column.getAfter("end")}px` : undefined,
    minWidth: `${column.getSize()}px`,
    zIndex: "var(--z-sticky-col)",
  }
}

function HeaderCell<TData extends RowData>({ header, pinned }: { header: Header<DataTableFeatures, TData, unknown>; pinned: boolean }) {
  const column = header.column
  const meta = column.columnDef.meta
  const canSort = column.getCanSort()
  const sorted = column.getIsSorted()
  const isPinned = column.getIsPinned()
  return (
    <TableHead
      data-pinned={isPinned || undefined}
      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : canSort ? "none" : undefined}
      style={pinStyle(column, pinned)}
      className={cn(
        "group/head h-8 border-b bg-card px-(--cell-px) text-2xs font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase",
        meta?.numeric && "text-right tabular-nums",
        isPinned === "start" && "border-r border-r-border-soft",
        isPinned === "end" && "border-l border-l-border-soft",
        meta?.className,
      )}
    >
      {header.isPlaceholder ? null : canSort ? (
        <button
          type="button"
          onClick={column.getToggleSortingHandler()}
          className={cn(
            "inline-flex h-full items-center gap-1 rounded-sm uppercase outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            meta?.numeric && "flex-row-reverse",
          )}
        >
          <FlexRender header={header} />
          {sorted === "asc" ? (
            <ArrowUpIcon className="size-3" aria-hidden="true" />
          ) : sorted === "desc" ? (
            <ArrowDownIcon className="size-3" aria-hidden="true" />
          ) : (
            <ChevronsUpDownIcon className="size-3 opacity-0 transition-opacity group-hover/head:opacity-40" aria-hidden="true" />
          )}
        </button>
      ) : (
        <FlexRender header={header} />
      )}
    </TableHead>
  )
}

/** Custom cells that return null or "" still render the em dash. */
function renderCell<TData extends RowData>(cell: Cell<DataTableFeatures, TData, unknown>): React.ReactNode {
  const content = flexRender(cell.column.columnDef.cell, cell.getContext())
  return content == null || content === "" ? EMPTY : content
}

function BodyCell<TData extends RowData>({ cell, pinned }: { cell: Cell<DataTableFeatures, TData, unknown>; pinned: boolean }) {
  const column = cell.column
  const meta = column.columnDef.meta
  const isPinned = column.getIsPinned()
  return (
    <TableCell
      data-pinned={isPinned || undefined}
      style={pinStyle(column, pinned)}
      className={cn(
        "border-b border-b-border-soft bg-card px-(--cell-px) py-(--cell-py) align-middle whitespace-nowrap group-hover/row:bg-[color-mix(in_srgb,var(--row-hover),var(--card))] group-data-[state=selected]/row:bg-transparent",
        meta?.numeric && "text-right tabular-nums",
        meta?.mono && "font-mono text-[12.5px]",
        isPinned === "start" && "border-r border-r-border-soft",
        isPinned === "end" && "border-l border-l-border-soft",
        meta?.className,
        meta?.cellClassName,
      )}
    >
      {renderCell(cell)}
    </TableCell>
  )
}

export function ViewOptions({ density, onDensity }: { density: Density; onDensity?: (next: Density) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="View options" className="gap-1.5 text-muted-foreground">
          <Settings2Icon strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
          View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-2xs tracking-wide text-muted-foreground uppercase">Density</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={density} onValueChange={(value) => onDensity?.(value as Density)}>
          {densities.map((option) => (
            <DropdownMenuRadioItem key={option} value={option} disabled={!onDensity}>
              {densityLabels[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PaginationBar({
  from,
  to,
  total,
  pageSize,
  pageSizes = [25, 50, 100],
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onPageSize,
}: DataTablePagination) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="tabular-nums">{formatRange(from, to, total)}</span>
      <div className="ml-auto flex items-center gap-2">
        {onPageSize && (
          <Select value={String(pageSize)} onValueChange={(value) => onPageSize(Number(value))}>
            <SelectTrigger size="sm" aria-label="Rows per page" className="h-7 gap-1 text-xs">
              <SelectValue />
              <span className="text-muted-foreground">per page</span>
            </SelectTrigger>
            <SelectContent>
              {pageSizes.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button size="sm" variant="outline" disabled={!hasPrevious} onClick={onPrevious} className="h-7">
          Previous
        </Button>
        <Button size="sm" variant="outline" disabled={!hasNext} onClick={onNext} className="h-7">
          Next
        </Button>
      </div>
    </div>
  )
}
