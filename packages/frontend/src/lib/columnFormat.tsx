import type {ReactNode} from 'react'
import type {TableColumnSchema} from '@/types/schema'
import {formatBytes, formatDateTime, formatRelativeTime, slugify} from '@/lib/format'

/**
 * Render one table cell from a schema-declared column.
 *
 * Formats are server-declared, so an unknown one degrades to plain text rather
 * than breaking the table.
 */
export function renderColumnValue(value: unknown, column: TableColumnSchema): ReactNode {
    const empty = column.emptyText ?? '-'
    if (value === null || value === undefined || value === '') return empty

    switch (column.format) {
        case 'datetime':
            return formatDateTime(value) ?? empty
        case 'relative':
            return formatRelativeTime(value) ?? empty
        case 'bytes':
            return typeof value === 'number' ? formatBytes(value) : empty
        case 'boolean':
            return value ? 'Yes' : 'No'
        case 'badge':
            return <span className={`badge ${slugify(String(value))}`}>{String(value)}</span>
        case 'code':
            return <code>{String(value)}</code>
        case 'list':
            return Array.isArray(value) ? value.join(', ') || empty : String(value)
        case 'text':
        default:
            return String(value)
    }
}

/** Sortable primitive for a cell value, honouring the column's format. */
export function sortableValue(value: unknown, column: TableColumnSchema): string | number | null {
    if (value === null || value === undefined || value === '') return null
    if (typeof value === 'number') return value
    if (typeof value === 'boolean') return value ? 1 : 0

    if (column.format === 'datetime' || column.format === 'relative') {
        const time = new Date(String(value)).getTime()
        return Number.isNaN(time) ? String(value) : time
    }

    return String(value)
}
