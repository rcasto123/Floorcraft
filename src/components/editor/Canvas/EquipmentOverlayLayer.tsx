import { useMemo } from 'react'
import { Layer, Rect } from 'react-konva'
import { useElementsStore } from '../../../stores/elementsStore'
import { useEmployeeStore } from '../../../stores/employeeStore'
import {
  isDeskElement,
  isWorkstationElement,
  isPrivateOfficeElement,
} from '../../../types/elements'
import type { CanvasElement } from '../../../types/elements'
import type { Employee } from '../../../types/employee'
import {
  computeDeskEquipmentStatus,
  statusColor,
  type EquippableDesk,
} from '../../../lib/equipmentOverlay'

/**
 * Konva layer that paints a translucent equipment-match tint on every
 * assigned seat-bearing element. Gated externally on
 * `useOverlaysStore().equipment` — this component assumes it should
 * render when mounted.
 *
 * For multi-seat elements (workstation, private office with 2 seats) we
 * currently paint ONE tint per element, derived from the first assigned
 * employee's needs. A per-seat visualization would need seat-local
 * coordinates we don't track on those element types today, and the
 * overlay's signal is still useful at element granularity — a desk
 * either has the equipment or it doesn't, regardless of which of its
 * occupants we check. If per-seat fidelity becomes important, we can
 * iterate `assignedEmployeeIds` and worst-case the status (i.e. paint
 * red if ANY occupant is unmet).
 *
 * `listening={false}` — this layer is decorative. Hit-tests for
 * selection / drag / drop must continue to go through the underlying
 * element renderers without interference.
 */
export function EquipmentOverlayLayer() {
  const elements = useElementsStore((s) => s.elements)
  const employees = useEmployeeStore((s) => s.employees)

  const rects = useMemo(() => computeRects(elements, employees), [
    elements,
    employees,
  ])

  if (rects.length === 0) return <Layer listening={false} />

  return (
    <Layer listening={false}>
      {rects.map((r) => (
        <Rect
          key={r.id}
          x={r.x - r.width / 2}
          y={r.y - r.height / 2}
          width={r.width}
          height={r.height}
          rotation={r.rotation}
          offsetX={0}
          offsetY={0}
          fill={r.color}
          // Small padding so the tint hugs the desk without leaking
          // beyond its footprint into adjacent elements.
          cornerRadius={4}
        />
      ))}
    </Layer>
  )
}

interface OverlayRect {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  color: string
}

/**
 * Exported for tests: walk every seat-bearing element, resolve the
 * primary assigned employee, and emit one rect when the status is not
 * `na`. Pure function — callers can pass fixture maps directly.
 */
export function computeRects(
  elements: Record<string, CanvasElement>,
  employees: Record<string, Employee>,
): OverlayRect[] {
  const out: OverlayRect[] = []
  for (const el of Object.values(elements)) {
    let desk: EquippableDesk | null = null
    let assignedId: string | null = null
    if (isDeskElement(el)) {
      desk = el
      assignedId = el.assignedEmployeeId
    } else if (isWorkstationElement(el)) {
      desk = el
      assignedId = el.assignedEmployeeIds[0] ?? null
    } else if (isPrivateOfficeElement(el)) {
      desk = el
      assignedId = el.assignedEmployeeIds[0] ?? null
    }
    if (!desk) continue

    const employee = assignedId ? employees[assignedId] ?? null : null
    const status = computeDeskEquipmentStatus(desk, employee)
    if (status === 'na') continue

    out.push({
      id: el.id,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      rotation: el.rotation,
      color: statusColor(status),
    })
  }
  return out
}
