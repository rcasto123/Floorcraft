import { useEffect, useState } from 'react'
import { Group, Image as KonvaImage, Rect } from 'react-konva'
import type { BackgroundImageElement } from '../../../types/elements'
import { useUIStore } from '../../../stores/uiStore'

interface Props {
  element: BackgroundImageElement
}

/**
 * Renderer for a `background-image` element — used as a tracing
 * underlay for floor plans imported from architectural sources (e.g.
 * a PNG/JPG of a CAD plan).
 *
 * Behaviour notes:
 *   - The image element is locked-by-default at insert time so a
 *     stray drag on the canvas doesn't displace the trace target.
 *     Locked elements still render; the lock only stops mutation.
 *   - Opacity defaults to 0.5 when the field is absent (legacy or
 *     freshly inserted) so the underlay reads as faded reference,
 *     not as a foreground photo.
 *   - We load the image via `new Image()` rather than the
 *     `use-image` hook so the renderer has zero hooks-deps surface
 *     and the loader survives a `storageUrl` swap (data URL → real
 *     URL when Storage lands).
 *   - A subtle dashed outline appears when selected so the operator
 *     can grab handles (resize, move) on what is otherwise a flat
 *     image area.
 */
export function BackgroundImageRenderer({ element }: Props) {
  const selectedIds = useUIStore((s) => s.selectedIds)
  const isSelected = selectedIds.includes(element.id)
  const [img, setImg] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!element.storageUrl) {
      setImg(null)
      return
    }
    let cancelled = false
    const next = new window.Image()
    // CORS for future Supabase Storage URLs. data: URLs ignore this
    // attribute entirely so it's safe for the v1 inline path.
    next.crossOrigin = 'anonymous'
    next.onload = () => {
      if (!cancelled) setImg(next)
    }
    next.onerror = () => {
      if (!cancelled) setImg(null)
    }
    next.src = element.storageUrl
    return () => {
      cancelled = true
    }
  }, [element.storageUrl])

  const w = element.width
  const h = element.height
  const opacity = typeof element.opacity === 'number' ? element.opacity : 0.5

  return (
    <Group rotation={element.rotation} listening={!element.locked}>
      {img ? (
        <KonvaImage
          image={img}
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          opacity={opacity}
        />
      ) : (
        // Loading / errored placeholder — a faint dashed rectangle so
        // the user still sees their underlay's footprint while the image
        // resolves (or to debug a broken URL).
        <Rect
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          fill="rgba(0,0,0,0.02)"
          stroke="rgba(0,0,0,0.2)"
          strokeWidth={1}
          dash={[6, 4]}
        />
      )}
      {isSelected && (
        <Rect
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          stroke="#0EA5E9"
          strokeWidth={1}
          dash={[4, 3]}
          listening={false}
        />
      )}
    </Group>
  )
}
