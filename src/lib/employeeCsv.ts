import Papa from 'papaparse'
import type { Employee, EmployeeImportRow } from '../types/employee'

/**
 * Round-trip-safe CSV export: column shape matches what `parseEmployeeCSV`
 * in `lib/csv.ts` consumes, so a user can Export CSV, edit in a spreadsheet,
 * and re-Import without mapping columns manually.
 *
 * Manager is exported as a *name* (not id) so the output is portable across
 * re-imports where ids will change. On import, names are resolved against
 * the full employee set (see `CSVImportDialog`'s two-pass resolver).
 */
export function employeesToCSV(
  employees: Employee[],
  allEmployees: Record<string, Employee>,
): string {
  const rows = employees.map((e) => ({
    name: e.name,
    email: e.email,
    department: e.department ?? '',
    team: e.team ?? '',
    title: e.title ?? '',
    manager: e.managerId ? (allEmployees[e.managerId]?.name ?? '') : '',
    type: e.employmentType,
    status: e.status,
    office_days: e.officeDays.join(', '),
    start_date: e.startDate ?? '',
    end_date: e.endDate ?? '',
    equipment_needs: e.equipmentNeeds.join(', '),
    equipment_status: e.equipmentStatus,
    photo_url: e.photoUrl ?? '',
    tags: e.tags.join(', '),
  }))
  return Papa.unparse(rows, { header: true })
}

/**
 * Trigger a browser download of the provided CSV text. Extracted so callers
 * can test the CSV generation independently of the download side-effect.
 *
 * Returns `true` on success. Returns `false` (and logs) when the browser
 * refuses — `URL.createObjectURL` can throw in sandboxed iframes or private
 * Safari; we don't want that to bubble into the autosave indicator.
 */
export function downloadCSV(filename: string, csv: string): boolean {
  let url: string | null = null
  let link: HTMLAnchorElement | null = null
  try {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    url = URL.createObjectURL(blob)
    link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    return true
  } catch (err) {
    if (typeof console !== 'undefined') console.error('CSV download failed:', err)
    return false
  } finally {
    if (link && link.parentNode) link.parentNode.removeChild(link)
    if (url) URL.revokeObjectURL(url)
  }
}

/**
 * Hard caps for CSV ingestion. PapaParse will happily chew through a
 * multi-GB file synchronously on the main thread and wedge the tab — and
 * we round-trip imports into a single JSONB payload that Postgres has a
 * documented 1 GB hard ceiling on.
 *
 *   - MAX_BYTES (5 MB)  → rejects oversized uploads before we allocate.
 *   - MAX_ROWS (10 000) → refuses absurd directories that would blow up
 *                         the office payload and DoS the UI.
 */
export const CSV_MAX_BYTES = 5 * 1024 * 1024
export const CSV_MAX_ROWS = 10_000

export class CSVTooLargeError extends Error {
  readonly kind: 'bytes' | 'rows'
  constructor(kind: 'bytes' | 'rows', message: string) {
    super(message)
    this.name = 'CSVTooLargeError'
    this.kind = kind
  }
}

export interface EmployeeCSVParseResult {
  headers: string[]
  rows: EmployeeImportRow[]
  errors: string[]
}

/**
 * Parse an HR CSV into `EmployeeImportRow`s. Throws `CSVTooLargeError`
 * for module-level failures (oversized file, too many rows). Per-row
 * data validation is NOT done here — that lives in `validateImportRows`.
 * Result rows are filtered to drop entirely blank ones (PapaParse can
 * emit trailing-newline empty rows); we preserve the original row index
 * on the returned rows so downstream validation can cite it.
 */
export function parseEmployeeCSV(text: string): EmployeeCSVParseResult {
  const byteLen = new Blob([text]).size
  if (byteLen > CSV_MAX_BYTES) {
    throw new CSVTooLargeError(
      'bytes',
      `CSV is ${(byteLen / 1024 / 1024).toFixed(1)} MB; the maximum is ${CSV_MAX_BYTES / 1024 / 1024} MB.`,
    )
  }

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })

  if (result.data.length > CSV_MAX_ROWS) {
    throw new CSVTooLargeError(
      'rows',
      `CSV has ${result.data.length.toLocaleString()} rows; the maximum is ${CSV_MAX_ROWS.toLocaleString()}. Split the file and import in batches.`,
    )
  }

  const headers = result.meta.fields || []
  const errors = result.errors.map((e) => `Row ${e.row}: ${e.message}`)

  const rows: EmployeeImportRow[] = result.data.map((row) => {
    const name = row.name || row.full_name || row.employee_name || ''
    const email = row.email || row.email_address || undefined
    const department = row.department || row.dept || undefined
    const team = row.team || row.group || undefined
    const title = row.title || row.role || row.job_title || undefined
    const manager = row.manager || row.manager_name || row.reports_to || undefined
    const type = row.type || row.employment_type || 'full-time'
    const status = row.status || row.employee_status || undefined
    const office_days = row.office_days || row.days || row.in_office || undefined
    const start_date = row.start_date || row.hire_date || undefined
    const end_date = row.end_date || row.termination_date || undefined
    const equipment_needs = row.equipment_needs || row.equipment || undefined
    const equipment_status = row.equipment_status || undefined
    const photo_url = row.photo_url || row.photo || row.avatar || undefined
    const tags = row.tags || undefined
    return {
      name,
      email,
      department,
      team,
      title,
      manager,
      type,
      status,
      office_days,
      start_date,
      end_date,
      equipment_needs,
      equipment_status,
      photo_url,
      tags,
    }
  })

  return { headers, rows, errors }
}

/**
 * Generic CSV serializer for the Export dialog's employee roster view,
 * which includes seat/floor columns that aren't part of the round-trip
 * schema. Kept separate from `employeesToCSV` because its column shape
 * differs and it isn't designed for re-import.
 */
export function exportEmployeeCSV(
  employees: Array<{
    name: string
    email: string
    department: string
    team: string
    title: string
    floor: string
    desk: string
    manager: string
    type: string
    office_days: string
    tags: string
  }>,
): string {
  return Papa.unparse(employees)
}
