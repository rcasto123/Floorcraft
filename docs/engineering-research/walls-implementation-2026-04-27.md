# Wall + Building-Element Implementation: Audit

Author: engineering research, 2026-04-27. Pairs with the parallel UX investigator
doc. **No code changes** — this is a model + cost-of-change inventory.

---

## Files inventoried

Type & data shape

- `src/types/elements.ts` — `WallElement`, `DoorElement`, `WindowElement`
  interfaces. `WALL_TYPES` const. `BaseElement.x/y/width/height/rotation`
  shared by every element including walls.
- `src/lib/elementBounds.ts` — wall AABB derived from `points` only
  (bulges are NOT considered).

Geometry / math

- `src/lib/wallPath.ts` — segment splitting, sagitta-based arc math
  (`arcFromBulge`), SVG `d` builder (`wallPathData`), `tangentAt`,
  `segmentMidpoint`, `locateOnStraightSegments`.
- `src/lib/wallEditing.ts` — `signedPerpOffset`, `clampBulge`,
  `applyBulgeFromDrag`, `applyVertexMove` (with adjacent-bulge re-clamp).
- `src/lib/wallAttachment.ts` — `findNearestStraightWallHit` (door/window
  snap math; arc segments are skipped).
- `src/lib/geometry.ts` — `snapToGrid`, `findAlignmentGuides`,
  `getSnappedPosition` (rect-vs-rect alignment guides; walls are not
  participants).

Drawing tool / interaction

- `src/hooks/useWallDrawing.ts` — wall-tool state machine. Click-to-vertex,
  click-drag-to-bulge, dblclick-to-finish, Esc-to-cancel via global
  `drawingCancelTick` bus on `useUIStore`.
- `src/components/editor/Canvas/WallDrawingOverlay.tsx` — live preview
  layer (dashed `<Path>`, vertex dots, dimension label).
- `src/components/editor/Canvas/WallEditOverlay.tsx` — endpoint + midpoint
  drag handles for selected wall(s). Uses `useElementsStore.temporal.pause()`
  to coalesce a drag stream into one undo snapshot.
- `src/components/editor/Canvas/CanvasStage.tsx` — top-level pointer
  router. Lines 479–486 dispatch press to `useWallDrawing`; lines 606–684
  perform door/window placement via `findNearestStraightWallHit`. Lines
  1086–1093 dispatch mouseup, 1017 dispatches dblclick.
- `src/components/editor/Canvas/AttachmentGhost.tsx` — door/window cursor
  preview that runs the same hit-test as click and surfaces a hit/no-hit
  signal back to `CanvasStage` for `cursor: not-allowed`.

Rendering

- `src/components/editor/Canvas/WallRenderer.tsx` — single `<Path>` with
  optional secondary rail (half-height) or `M` text (demountable).
- `src/components/editor/Canvas/DoorRenderer.tsx`,
  `WindowRenderer.tsx` — resolve `parentWallId` + `positionOnWall` to a
  world point + tangent each render. No cached world coords.
- `src/components/editor/Canvas/ElementRenderer.tsx` — top-level dispatch.
  Lines 297–416 wire walls/doors/windows into the layer with `ownsPosition`
  semantics (Group anchored at 0,0, geometry baked into `points`).
- `src/components/editor/Canvas/SelectionOverlay.tsx` — Konva `<Transformer>`
  attaches to selected elements. Lines 41–51 explicitly **filter walls,
  doors, and windows out** of the transformable set.

Persistence + cascades

- `src/lib/offices/loadFromLegacyPayload.ts` (lines 142–169) — wall
  migration: back-fills `bulges` (zero-padded to `points.length/2 - 1`),
  `connectedWallIds` (default `[]`), `wallType` (default `'solid'`).
- `src/lib/seatAssignment.ts` (lines 556–582) — `deleteElements` cascade:
  deleting a wall also deletes every door / window with matching
  `parentWallId` in one zundo snapshot.
- `src/lib/planHealth.ts` (lines 293–331) — proximity heuristic for
  detached doors/windows. Uses wall AABB (chord-only, ignores bulges).

Tests (assumptions baked in)

- `src/__tests__/wallPath.test.ts`, `wallEditing.test.ts`,
  `useWallDrawing.test.ts`, `curvedWallFlow.test.tsx` — geometry +
  draw-flow.
- `src/__tests__/WallRenderer.test.tsx`, `wallTypeRender.test.tsx`,
  `wallStyling.test.tsx` — rendering + Properties panel coverage.
- `src/__tests__/WallEditOverlay.test.tsx` — handle drag thresholding +
  zundo coalescing.
- `src/__tests__/wallAutoSave.test.ts`, `wallTypeMigration.test.ts` —
  legacy payload round-trip.
- `src/__tests__/wallAttachmentGhost.test.tsx` — door/window ghost.

---

## Data model: how walls are represented

A wall is a top-level `WallElement extends BaseElement`. It inherits the
universal `id`, `x`, `y`, `width`, `height`, `rotation`, `locked`,
`groupId`, `zIndex`, `label`, `visible`, `style`, `zone` fields, but
**five of those are dead on a wall**: `x`, `y`, `width`, `height`, and
`rotation` are uniformly stored as `0` and ignored by the renderer.
The geometry lives in:

```ts
// src/types/elements.ts:102-127
interface WallElement extends BaseElement {
  type: 'wall'
  points: number[]                       // [x0,y0, x1,y1, x2,y2, ...]
  bulges?: number[]                      // length === points.length/2 - 1
  thickness: number
  connectedWallIds: string[]
  dashStyle?: 'solid' | 'dashed' | 'dotted'
  wallType: WallType
}
```

`points` is a flat interleaved array of absolute world coordinates. A wall
with N vertices has `points.length === 2 * N` and `bulges.length === N - 1`
— one bulge per segment. `bulges[i]` is the **signed perpendicular offset
from the chord midpoint to the arc midpoint** in screen coords (y grows
down, so a positive bulge visually lifts the arc above a left-to-right
chord — see `src/lib/wallPath.ts` header comment for the sign convention).
A bulge of `0` (or a missing/short `bulges` array) means the segment is
straight. The drawing tool clamps `|bulge| <= chordLen/2` so every arc is
at most a half-circle, which lets the SVG `A` command keep `largeArc=0`
and avoid sweep ambiguity.

`connectedWallIds` is **declared but unused**. Every code path that
constructs a wall (`useWallDrawing.ts:330`, demo + template seeders, the
legacy loader) sets it to `[]`. No reader anywhere in `src/` consults it.
It is dead metadata kept alive because removing it would force a payload
migration. `dashStyle` is orthogonal to `wallType` (the
solid/glass/half-height/demountable semantic): a glass wall can still be
dashed; demountable walls auto-dash if the user hasn't explicitly chosen
solid (see `WallRenderer.tsx:65-75`).

Doors and windows live as **separate top-level elements** with a
`parentWallId: string` and `positionOnWall: number ∈ [0, 1]`. The
parametric position is measured along the **concatenated length of the
wall's straight segments only** — arcs are skipped (see
`wallPath.ts:locateOnStraightSegments`). Doors and windows do not
appear in the wall's data; the relationship is one-way (child → parent).

---

## Rendering pipeline

1. `ElementRenderer` (`ElementRenderer.tsx:297-416`) walks the elements
   map sorted by `zIndex` and dispatches each one to a per-type renderer.
   Walls, doors, windows, and points-primitives (line/arrow) opt into
   `ownsPosition`: their wrapping `<Group>` is mounted at `(0, 0)` and the
   underlying renderer is responsible for placing geometry in absolute
   world space.

2. `WallRenderer` (`WallRenderer.tsx:34-138`) calls
   `wallPathData(points, bulges)` which emits a single SVG-style `d`
   string of the form `M x0 y0 L x1 y1 A r r 0 0 sweep x2 y2 L x3 y3 ...`
   — `L` for straight segments, `A` for arcs. The data feeds a single
   `<Path>` Konva primitive (chosen over `<Line>` so the node identity
   stays stable when a segment toggles between straight and curved
   mid-drawing — switching node types would force react-konva to
   destroy/recreate and disrupt any in-flight Transformer / drag, see
   the comment at `WallRenderer.tsx:11-19`).

3. Wall-type effects compose on top of that base path:
   - `solid`: nothing extra.
   - `glass`: opacity 0.4 on the wrapping `<Group>` and a lighter blue
     stroke when the user hasn't overridden the default.
   - `half-height`: a second `<Path>` over the same `d`, thinner +
     dashed, painted at 0.5 opacity. Implemented as an over-stroke
     because a true parallel-offset would require normal sampling on
     arcs (expensive).
   - `demountable`: dashed by default + an `M` `<Text>` marker at the
     **first** segment's midpoint (single marker per wall, useful for
     export legends).

4. Hit-testing is performed by Konva on the `<Path>` itself. The
   renderer bumps `hitStrokeWidth = max(12, thickness + 6)` so thin
   walls (`thickness: 6` is the default) stay clickable. Selecting a
   wall sets `useUIStore.selectedIds` and the next render returns a
   blue stroke. There is **no hover bounding box** — selection is a
   stroke colour change on the actual polyline.

5. Rotation/scaling: `SelectionOverlay.tsx:41-51` filters walls (and
   doors/windows) out of the Konva `Transformer` set. Walls cannot be
   rotated, scaled, or skewed via the standard handles — the
   per-vertex `WallEditOverlay` is the only structural editor.

6. Doors and windows render at the world position derived from
   `parentWallId.points` + `positionOnWall` each frame
   (`DoorRenderer.tsx:33-60`, same shape in `WindowRenderer.tsx`). Their
   own `x`, `y`, `rotation` fields exist as a fallback but are
   functionally **shadow state** — never authoritative when the parent
   wall is present.

---

## Interaction pipeline

The wall tool's state machine is in `src/hooks/useWallDrawing.ts`. It
keeps an authoritative `sessionRef` plus a React-state mirror; preview
moves are coalesced to one rAF, commits flush synchronously. The state:

```ts
interface WallDrawingState {
  isDrawing: boolean
  points: number[]            // committed vertices
  bulges: number[]            // committed segment bulges
  currentPoint: { x, y }      // live cursor (snapped)
  previewBulge: number | null // live bulge while click-dragging
}
```

Pointer flow (`useWallDrawing.ts:174-337`):

1. **mouseDown**: stash the press at `pressRef`. Note that the canvas is
   in **wall mode** — the press doesn't yet commit anything.
2. **mouseMove (no press)**: update `currentPoint` so the overlay can
   render a hover dot at the snap target.
3. **mouseMove (pressed, drawing in progress, travel ≥ 4 px)**: compute a
   live `previewBulge` via `signedPerpOffset` and clamp to `chord/2`. The
   overlay renders the pending segment as an arc.
4. **mouseUp**: commit a vertex at the press location. If travel ≥ 4 px,
   commit the dragged-out bulge for the just-finished segment;
   otherwise commit a straight segment (bulge 0).
5. **dblclick**: finalise. `useCanvasStore.getState().wallDrawStyle`
   (read at commit time, not at draw start) is applied as the
   `dashStyle` if non-`'solid'`. The wall is `addElement`-ed.
6. **Esc**: a global `drawingCancelTick` counter on `useUIStore` is
   bumped by `useKeyboardShortcuts`; this hook subscribes and resets
   the session.

**Snap logic during drawing is grid-only.** When `settings.showGrid` is
true, `snapPoint` runs `snapToGrid(value, gridSize)` (see
`useWallDrawing.ts:92-100`). There is **no snap to existing wall
endpoints**, **no 90/45-degree angle snap**, and **no "stick to a
neighbouring wall's tangent"**. Grid is the only assist; with grid off,
the user is hand-eyeing every vertex.

Door/window placement is handled in `CanvasStage.tsx:606-684`. On a
left-click in `door`/`window` mode, the stage runs
`findNearestStraightWallHit` (with snap radius `DOOR_WINDOW_SNAP_PX`,
which is `24px` divided by current `stageScale` so it stays ~24 screen
pixels regardless of zoom). If no wall is in range, the click is
silently ignored — there is **no orphan placement**. After placement the
tool auto-returns to `select`.

`WallEditOverlay` (selected-wall vertex/midpoint handles) is mounted in
its own Layer above ElementRenderer. Each handle is a Konva `<Circle>`
with `draggable`. A drag fires three callbacks:

- `onDragStart`: stash start-pointer in `dragRef`.
- `onDragMove`: if travel ≥ 2 px, mark "armed" and pause zundo's
  temporal middleware so the stream of `updateElement` calls produces
  one undo snapshot. Apply `applyVertexMove` or `applyBulgeFromDrag`.
- `onDragEnd`: resume zundo, commit one final pointer to absorb any
  un-emitted `dragMove` between throttle and release. If sub-threshold,
  snap the handle back and treat as a click (no-op).

`applyVertexMove` (`wallEditing.ts:85-123`) **also re-clamps adjacent
bulges**: moving a vertex shortens or lengthens the chord(s) that touch
it, and a bulge that was legal at the old chord can violate
`|bulge| <= chord/2` at the new chord. The two adjacent segments are
re-clamped; non-adjacent ones are untouched.

---

## What's currently editable post-placement

What you **CAN** do today:

- Change `thickness`, `dashStyle`, `wallType`, and `style.stroke` from
  the Properties panel (`PropertiesPanel.tsx:1458-1509`). Multi-select
  fans the change to every selected wall
  (`PropertiesPanel.tsx:1129-1180`).
- Drag any **vertex** to a new world position (`WallEditOverlay`).
  Adjacent bulges re-clamp automatically.
- Drag any **segment midpoint** to bulge that segment (positive or
  negative side of the chord; deadzone of 2 canvas units snaps back to
  straight). One handle per segment, regardless of straight or curved.
- Delete the wall — every attached door/window cascade-deletes in the
  same zundo snapshot (`seatAssignment.ts:572-582`).
- Toggle `visible` and `locked` (universal element controls).

What you **CANNOT** do today:

- **Translate the wall as a whole.** Walls inherit the generic `Group`
  drag from `ElementRenderer` (`groupDraggable && !isAttached`, true for
  walls) but the `dragEnd` handler writes `{x, y}` to the wall while the
  renderer hard-codes `Group x = 0` for `ownsPosition` elements
  (`ElementRenderer.tsx:394-395`). The visual ghost moves during drag,
  the store updates `wall.x`/`wall.y`, but those fields are ignored on
  the next render — **the wall snaps back**. This is a real bug, not a
  documented "feature": there is no `points`-translation handler. The
  only way to "move" a wall is to drag every vertex individually.
- **Rotate the wall.** Filtered out of the Transformer
  (`SelectionOverlay.tsx:41-51`). `BaseElement.rotation` is stored but
  never applied.
- **Scale / resize the wall.** Same Transformer filter.
- **Add a vertex mid-segment** (insert a bend in an existing wall).
  No "click to add vertex" affordance on the edit overlay.
- **Delete a single vertex** without deleting the whole wall.
- **Reverse / split / merge walls.** No "split here" or "join two walls"
  command.
- **Connect two walls structurally.** `connectedWallIds` is dead;
  endpoints don't snap to other walls' endpoints during drawing or
  vertex drag, and nothing ensures two visually-coincident endpoints
  share coordinates.
- **Re-anchor a door/window to a different wall.** Doors/windows are
  not draggable on canvas (`ElementRenderer.tsx:316`,
  `groupDraggable = draggable && !isAttached`). The Properties panel
  shows `parentWallId` as a read-only string; the only repositioning UI
  is the `positionOnWall` slider. Reassigning means delete + recreate.

---

## Connectivity + attachment model

Doors and windows are attached **by reference** (`parentWallId`) plus a
**parametric position** (`positionOnWall ∈ [0, 1]`). The position is
defined against the concatenated length of the wall's STRAIGHT segments
only — see `wallPath.ts:locateOnStraightSegments`. This has consequences:

- A door positioned at `0.5` on a wall with two straight segments of
  equal length sits at the boundary between them. If the user later
  drags vertex 1 to lengthen the first segment, the door's world position
  moves too — but proportionally, not absolutely. From the user's
  perspective: editing a wall **moves attached doors as a side effect**,
  which is sometimes what they want (the door follows its wall) and
  sometimes a surprise (the door drifts into an awkward spot when a
  vertex is repositioned for an unrelated reason).
- A door on a wall whose segments include arcs **counts only the
  straight portions** when computing position. Adding a curve to a wall
  with an attached door silently shifts the door's world position
  because `totalStraight` shrinks. There is no "doors-can't-attach-to-
  curves" UX message; the user just sees the door drift.
- If the wall is deleted, every door and window with matching
  `parentWallId` is cascade-deleted (`seatAssignment.ts:572-582`).
- If the wall is **moved invalidly** (impossible today — see above),
  the door would re-resolve to the new wall geometry on next render.
- If `parentWallId` points at a **non-existent id** (e.g. the wall was
  deleted via a path that bypassed `deleteElements`, or a payload was
  corrupted), `DoorRenderer`/`WindowRenderer` fall back to the door's
  own `x`/`y`/`rotation`. The door appears as an "orphan" rectangle
  where it last stood, with no swing arc tangent. `planHealth.ts:293-331`
  surfaces a warning in this case — but only via the proximity-to-AABB
  heuristic, which uses chord-only AABB and so isn't tight on curved
  walls.

`connectedWallIds: string[]` is **dead**. It is constructed (always as
`[]`), persisted, migrated through legacy loader, and never read.
Removing it cleanly requires a payload migration (back-compat
`?connectedWallIds`); leaving it incurs a few dozen bytes per wall plus
the cognitive overhead of "is this load-bearing?" — answer: no.

---

## Where the model is fragile

1. **`points: number[]` is great for storage, painful for editing.** It
   is a flat interleaved array of absolute world coordinates with
   parallel `bulges[]`. Any structural edit (insert vertex, delete
   vertex, reverse, split, merge) becomes index gymnastics:

   - Inserting vertex `i` requires splicing 2 entries into `points` AND
     1 entry into `bulges` AND deciding what to do with the bulge of
     the segment being split (current code has no concept of "split
     this arc into two arcs at parameter t"; the natural answer is
     "lose the bulge", but that's a UX surprise).
   - Deleting vertex `i` requires splicing 2 from `points`, 1 from
     `bulges`, and deciding whether to keep the new combined
     segment's bulge (probably no — chord changed, original bulge
     intent is lost).

   Compare with a `vertices: { x, y }[]` + `segments: { bulge }[]`
   shape, which is isomorphic but reads/writes one segment at a time.
   The existing flat shape is wire-compatible with Konva's `<Line>`,
   which we no longer use (we render `<Path>`); so the storage benefit
   is mostly historical.

2. **No translation handler.** Wall drag commits `{x, y}` that the
   renderer ignores (`ElementRenderer.tsx:394-395` vs
   `ElementRenderer.tsx:230-242`). This is a latent footgun for any
   feature that does "move the selection" (group drag, keyboard arrow
   nudge, paste-with-offset). If a paste path tries to offset a wall
   by `+50, +50`, it must mutate every entry in `points`, not the
   `x`/`y` fields. Any code that touches selections and assumes
   "everything is center-origin" is wrong about walls.

3. **AABB ignores bulges.** `elementBounds` (`elementBounds.ts:22-38`)
   walks `points` only. A heavily-bulged segment can extend
   `bulge` units beyond its chord on either side — and the AABB
   doesn't know. Consequences: minimap thumbnails, focus/zoom-to-fit,
   marquee selection, alignment-guide rect computation, and
   `planHealth`'s "is this door near a wall" check all under-report
   curved walls' true extent.

4. **`positionOnWall` is in straight-segment units.** Adding a curve
   shifts every door already on the wall. Removing a straight segment
   that bordered an arc can place a door's parametric position in a
   region with no straight segments at all — `locateOnStraightSegments`
   then returns `null`, the door falls back to its stale `x`/`y`, and
   the door visually decouples from the wall.

5. **Doors are not first-class to walls.** The wall has no list of its
   doors; deletion+cascade scans every element on every wall delete
   (`seatAssignment.ts:572-582`). For an office with hundreds of
   doors/windows this is `O(N_elements)` per wall delete — fine today,
   silently quadratic on large floors if multi-wall delete becomes
   common.

6. **Snap radius is in canvas units divided by stage scale.** The math is
   `DOOR_WINDOW_SNAP_PX / stageScale` for the door tool
   (`CanvasStage.tsx:621-624`). At very high zoom the radius collapses
   to a fraction of a canvas unit. With grid off, hitting a wall can
   feel finicky; with grid on, the user fights the grid snap pulling
   away from the wall snap.

7. **Wall translation cannot be implemented without picking which side
   "owns" anchored doors.** If a wall translates by `(dx, dy)`, the
   geometric thing is to update every entry in `points`. But a door's
   world position is `wallPoints[seg] + tInSegment * delta`, so the
   door automatically follows. That's correct. However, if a future
   feature lets the user **drag a wall** (the obvious next move), the
   group transform from Konva will deliver `(dx, dy)` exactly once on
   `dragEnd`, and we have to translate `points` AND notify the
   `WallEditOverlay` so its handles re-render at the new vertex
   positions. Today nothing does that.

8. **Zundo coalesces only inside `WallEditOverlay`.** A drag of a
   single endpoint or midpoint is one undo step. But a drag-translate
   of an entire wall (when implemented), or a multi-vertex selection
   move, currently has no analogue — each `updateElement` would emit
   a snapshot. Any future multi-vertex / wall-translate work needs
   to wire the same `temporal.pause()` pattern in.

---

## Where small changes pay off big

Engineering cost in person-days (rough). UX impact is "what would the
investigator likely flag":

1. **Translate-wall via vertex-array offset on dragEnd. ~0.5 day.**
   Override `handleDragEnd` for walls to compute the delta from the
   group node and write `points: points.map((v, i) => v + (i % 2 ? dy : dx))`
   instead of `{x, y}`. Doors/windows automatically follow because they
   resolve from `points`. This unblocks the most fundamental UX
   complaint ("I can't move a wall after drawing it").

2. **Endpoint snap during drawing AND vertex drag. ~1 day.** Reuse the
   logic from `findNearestStraightWallHit` but check the **endpoint
   set** (every other-wall vertex) within a small radius. Apply at
   `useWallDrawing.snapPoint` and at `applyVertexMove` (or in the
   `WallEditOverlay`'s `onDragMove` callback). Clean snap to existing
   wall corners + closes the gap on the "two walls don't meet" UX.

3. **90/45-degree angle snap during drawing. ~0.5 day.** When a press
   is active and a previous vertex exists, project the candidate
   vertex onto the nearest cardinal/diagonal ray from the prior
   vertex if within an angular tolerance. Standard "hold Shift to lock
   angle" affordance is one extra branch.

4. **Auto-straighten short bulges. Already exists** (`BULGE_DEADZONE_PX
   = 2` in `wallEditing.ts:10`) but the threshold is in canvas units;
   a UX win is making it scale-aware — at high zoom the deadzone is
   too small to be useful. ~0.25 day.

5. **Replace dead `connectedWallIds: string[]` with auto-derived
   adjacency for snap UI. ~1 day.** The field can stay (back-compat)
   but a derived helper that scans walls' endpoints for coincidences
   would let us highlight connected corners during edit. Same
   adjacency data also unlocks "select connected walls" (Ctrl-click).

6. **"Convert wall ends to door" gesture.** Today, placing a door
   requires switching tools. A right-click on a wall (or a small
   floating action when a wall is selected) that opens a "place door
   here" affordance saves 2 mode switches. ~1 day.

7. **Auto-finish wall on Enter / on second click at start vertex
   (close polygon).** State machine already supports it; just one
   condition in `handleCanvasMouseUp`. ~0.25 day. Big UX win for
   drawing rooms.

---

## Where small UX changes cost a lot

1. **"Drag a vertex to extend the wall" + "drag the midpoint to add a
   bend".** The first one already exists. The second one — adding a
   *new* vertex by dragging the middle of a segment — sounds like a
   small change but is structurally different from the current bulge
   drag. It requires:
   - distinguishing "drag this midpoint to bulge" vs "drag to insert
     a vertex" (modifier key? hover affordance?);
   - splicing one entry into `points` and one into `bulges` mid-drag,
     which means the WallEditOverlay handle indices change live, which
     means refs must be re-keyed mid-drag, which means the
     `dragRef` keying scheme (`${wallId}:m:${si}`) breaks.

   ~3-5 days incl. tests.

2. **Per-segment line styles.** `dashStyle` and `wallType` are wall-
   level. Letting one wall be half-glass / half-solid is a real
   architectural ask but requires either splitting it into two walls
   automatically (ugh, structural edit that breaks
   `connectedWallIds`-derived adjacency, doors might land on the wrong
   half) OR promoting `dashStyle` and `wallType` to per-segment
   arrays (parallel to `bulges`). The latter means new payload migration
   + a UX to pick which segment the user is editing. ~5-8 days.

3. **Doors/windows on curved segments.** Today every snap path
   short-circuits at `seg.bulge !== 0` (`wallAttachment.ts:86`,
   `wallPath.ts:locateOnStraightSegments`). To support arc-attached
   doors we'd need:
   - arc-aware closest-point math (well-known but new code);
   - generalised `positionOnWall` measured along **all** segments not
     just straight (breaking change; existing payloads' positions
     re-interpret unless migrated);
   - door tangent along an arc means rotation changes with position
     (already implemented for straight via `tangentAt`, just untested
     on arcs);
   - decision: should doors **bend** with the wall (curved door panel)
     or stay rectangular and tangent at one point (visual gap on a
     tight curve)? Real architects expect the latter.

   ~5-7 days, ~half of which is regression testing the door/window
   placement story.

4. **Group-rotate including walls.** Konva Transformer is filtered to
   exclude walls today. Rotating a wall as part of a multi-selection
   means rotating its `points` around the selection's pivot —
   trivial math, but it requires lifting the `Transformer` -> wall
   exclusion AND writing back rotated `points` (NOT `rotation`) on
   transform end. Adjacent walls on selection stay disconnected —
   "rotate this corner" is not the same as "rotate this whole room".
   ~2 days.

5. **A first-class "Room" concept** (closed wall polygon + auto-
   detected interior). Not present today and not a small change; a
   true rooms model wants `interior` as a derived shape, with doors
   that know which room they connect, etc. ~10+ days, much bigger
   than the wall layer alone.

---

## Performance posture

- **Memoisation:** wall renderers are not memoised (`React.memo` is not
  used). `WallRenderer`, `DoorRenderer`, `WindowRenderer` re-render on
  every `useUIStore.selectedIds` change because they all subscribe to
  it. Doors/windows additionally subscribe to `elements[parentWallId]`,
  so they re-render when the parent wall changes. Walls themselves
  re-render when `selectedIds` changes (for the colour swap) or any
  parent re-renders.
- **Hit-testing:** Konva's standard hit-test on a `<Path>` with
  `hitStrokeWidth` set. O(walls) per click, but each test is cheap (a
  bounding-box pre-filter inside Konva, then path-stroke containment).
  At reasonable wall counts (<200) this is invisible.
- **`findNearestStraightWallHit`:** linear scan over every element on
  every door/window mousemove (the AttachmentGhost subscribes to the
  full elements map so it re-runs on any change). `useMemo` reduces
  re-runs to "elements/cursor/scale changed" but on a busy office
  every drag of any element re-runs the door hit test. For a few
  hundred walls this is fine. Above ~1000 walls + doors actively
  dragging, expect noticeable jitter.
- **`elementBounds`** ignores bulges (cheaper, slightly wrong).
- **Realistic wall budget:** Up to ~500 walls in a typical office, the
  bottleneck is *not* the renderer — it's the `WallEditOverlay`
  rendering one Konva `<Circle>` per vertex per selected wall and the
  full elements-map scans inside `AttachmentGhost`. Single-wall
  selected, hundreds of unselected: 60fps comfortable. 50+ walls
  selected at once with the edit overlay live: expect fewer than 60fps
  in dev builds; production should still hold up.
- **Undo/redo:** zundo wraps `useElementsStore` (`elementsStore.ts:43`).
  `WallEditOverlay` correctly pauses temporal during a drag stream so
  one drag = one snapshot. Wall-tool dblclick commits a single
  `addElement` call so it's also one snapshot. Cascading wall delete
  + door delete is a single combined `setElements` call so it's one
  snapshot too (`seatAssignment.ts:599-...`).

---

## Recommendations (engineering-perspective)

### P0 — viable in this week

- **Fix wall translation.** Override the dragEnd path for walls so the
  group delta translates `points` instead of writing dead `x`/`y`. Half
  a day; the highest-leverage UX fix in the doc. Files:
  `ElementRenderer.tsx:230-242`, plus a new helper in `wallEditing.ts`
  (e.g. `translateWall(wallId, dx, dy)`).
- **Endpoint snap while drawing the wall tool.** During mousemove with
  a press active, check for a nearby existing-wall vertex (within e.g.
  10 / stageScale canvas units) and prefer that over grid snap. Same
  for the vertex-drag handle. ~1 day. Files: `useWallDrawing.ts:92-100`,
  `WallEditOverlay.tsx:125-150`. **No data shape change.**
- **Cardinal angle lock during drawing.** Either auto (within tolerance)
  or shift-held. Massive UX win for "I just want a 90-degree corner".
  ~0.5 day. File: `useWallDrawing.ts:174-225`.
- **Close-the-polygon affordance.** When the live cursor is within snap
  radius of `points[0..1]` and the wall has ≥ 3 vertices, treat the
  next click as "commit at start vertex AND finish". Cheap. ~0.5 day.

### P1 — next sprint, requires modest refactor

- **Insert / delete vertex on the edit overlay** (right-click a
  segment to insert; right-click a vertex to delete). Touches the
  drag-key scheme in `WallEditOverlay.tsx` (refs become stale mid-edit)
  but no payload change. ~2-3 days.
- **Bulges-aware `elementBounds`.** Compute true AABB by sampling each
  bulged segment's extreme points. ~0.5 day in `elementBounds.ts` plus
  any test that asserts a chord-only bound (one or two will need
  updating). Unblocks correct minimap + focus + planHealth detached-
  door check on curved walls.
- **Memoise wall/door/window renderers** via `React.memo` with a
  custom equality on `(element, isSelected, parentWallVersion)`. Worth
  measuring before committing; Konva's own batchDraw absorbs a lot of
  the cost already. ~1 day.
- **Promote `connectedWallIds` to live derived adjacency** (or remove
  it). Either path is a payload-touching change; the adjacency data
  unlocks corner-snap UI and "select connected walls". ~1 day.

### P2 — future, requires model change

- **Switch `points: number[]` to `vertices: { x, y, bulgeIn?, bulgeOut? }[]`
  or the equivalent record-shape.** This is the single most expensive
  change in the doc and the one that unblocks every "edit a wall like
  it's a real polyline" feature simultaneously: insert/delete vertex,
  split, merge, group rotate, per-segment styles. **Requires payload
  migration** in `loadFromLegacyPayload.ts:142-169` (write both shapes
  during transition; read either; flip writers later). ~5-7 days.
- **Doors/windows on arc segments.** Generalises `positionOnWall` to
  walk **all** segments, not just straight. Breaking change for
  existing positions; needs a migration that preserves the world-space
  position (re-derive parametric `t` against new total length).
  ~5-7 days.
- **Per-segment `dashStyle` / `wallType` arrays.** Once vertices are
  records, a parallel `segmentStyle: WallSegmentStyle[]` is natural.
  Ship after the shape change. ~3-5 days.
- **First-class Room concept** built on closed-polygon detection across
  walls. Largest scope; would also let us auto-compute square footage,
  egress paths, and "is this room reachable". ~10+ days.

Items requiring data-shape change: every P2 item. Every P0 + P1 item
keeps the wire format identical (modulo a soft-deprecation of
`connectedWallIds`).

---

## Open questions for product

1. **What does "move a wall" mean?** Translate-as-rigid-body (every
   vertex moves by the same delta), or grab-and-stretch from a
   midpoint (one vertex held, the rest follows IK-style)? P0 assumes
   the rigid-body interpretation.
2. **Do doors live "on" a wall, or "at" a position?** When a wall is
   reshaped, do attached doors follow proportionally (current
   behaviour, can drift visually) or stay put in world space (would
   need a "snap back" if no longer touching the wall)?
3. **Are arcs in walls a real architectural need or a nice-to-have?**
   Curved walls today are second-class (no arc-attached doors, AABB
   ignores them, parametric attachment skips them). If the answer is
   "demo polish only", maybe we strip them. If "real CAD" we have a
   non-trivial roadmap to make them fully first-class.
4. **Is endpoint snap a stronger request than 90-degree snap?** Both
   are P0 and roughly the same engineering cost; pick the order based
   on which UX complaint is loudest.
5. **Does multi-wall transformer rotation matter** (rotate a whole
   room of selected walls together)? Cheap-ish with the current shape
   (P1) but UX behaviour around adjacent-wall break-points is fuzzy
   — what happens to the door on the boundary between a rotated wall
   and a stationary one?
6. **Should we cleanly retire `connectedWallIds` or keep it and start
   populating it?** Either is fine; the limbo state is the worst.
7. **What's the realistic floor scale ceiling?** If product expects
   campuses with 5k+ walls (multi-floor mega-tenants), the
   memoisation + hit-test work shifts from P1 to P0. Today's
   undocumented budget is "low hundreds, no problem."
