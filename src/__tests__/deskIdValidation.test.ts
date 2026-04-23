import { describe, it, expect } from 'vitest'
import { validateDeskId } from '../lib/deskIdValidation'
import type { CanvasElement } from '../types/elements'

function desk(id: string, deskId: string, floorId = 'f1'): CanvasElement {
  return {
    id,
    type: 'desk',
    floorId,
    x: 0,
    y: 0,
    width: 60,
    height: 60,
    rotation: 0,
    deskId,
    assignedEmployeeId: null,
    capacity: 1,
  } as CanvasElement
}

function workstation(id: string, deskId: string, floorId = 'f1'): CanvasElement {
  return {
    id,
    type: 'workstation',
    floorId,
    x: 0,
    y: 0,
    width: 120,
    height: 60,
    rotation: 0,
    deskId,
    positions: 4,
    assignedEmployeeIds: [],
  } as CanvasElement
}

describe('validateDeskId', () => {
  it('returns null for a unique id on the same floor', () => {
    const elements = { a: desk('a', 'D-1'), b: desk('b', 'D-2') }
    expect(validateDeskId('D-3', 'a', elements)).toBeNull()
  })

  it('returns an error when another element on the same floor has the same id', () => {
    const elements = { a: desk('a', 'D-1'), b: desk('b', 'D-2') }
    const err = validateDeskId('D-2', 'a', elements)
    expect(err).toMatch(/already used/i)
  })

  it('is case-insensitive', () => {
    const elements = { a: desk('a', 'D-1'), b: desk('b', 'D-2') }
    expect(validateDeskId('d-2', 'a', elements)).toMatch(/already used/i)
  })

  it('trims whitespace before comparing', () => {
    const elements = { a: desk('a', 'D-1'), b: desk('b', 'D-2') }
    expect(validateDeskId('  D-2  ', 'a', elements)).toMatch(/already used/i)
  })

  it('allows keeping the same id on the element being edited (self)', () => {
    const elements = { a: desk('a', 'D-1'), b: desk('b', 'D-2') }
    expect(validateDeskId('D-1', 'a', elements)).toBeNull()
  })

  it('allows the same id on a different floor (desk ids are per-floor)', () => {
    const elements = {
      a: desk('a', 'D-1', 'floor-1'),
      b: desk('b', 'D-1', 'floor-2'),
    }
    expect(validateDeskId('D-1', 'b', elements)).toBeNull()
  })

  it('detects collisions across desk + workstation + private-office on the same floor', () => {
    const elements = {
      a: desk('a', 'D-1'),
      w: workstation('w', 'W-1'),
    }
    const err = validateDeskId('W-1', 'a', elements)
    expect(err).toMatch(/already used/i)
  })

  it('rejects an empty id', () => {
    const elements = { a: desk('a', 'D-1') }
    const err = validateDeskId('', 'a', elements)
    expect(err).toMatch(/required|empty/i)
  })

  it('rejects a whitespace-only id', () => {
    const elements = { a: desk('a', 'D-1') }
    const err = validateDeskId('   ', 'a', elements)
    expect(err).toMatch(/required|empty/i)
  })

  it('ignores non-assignable elements when checking collisions', () => {
    const elements = {
      a: desk('a', 'D-1'),
      r: {
        id: 'r',
        type: 'conference-room',
        floorId: 'f1',
        x: 0, y: 0, width: 100, height: 100, rotation: 0,
        roomName: 'D-2',
        capacity: 6,
      } as CanvasElement,
    }
    expect(validateDeskId('D-2', 'a', elements)).toBeNull()
  })
})
