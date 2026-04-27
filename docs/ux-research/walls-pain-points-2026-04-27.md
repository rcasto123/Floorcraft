# Wall + Office Building Element Pain Points

## Investigation context

- **Date:** 2026-04-27
- **Branch / commit:** `main` @ 9aa3b89 (top of branch at investigation start)
- **Environment:** local dev worktree, Vite dev server, code-walkthrough plus interactive verification of the wall, door, window, and room flows
- **Investigator:** UX research agent (parallel pass with an Engineering investigator agent)
- **Scope tested:** the `wall` tool, `door` tool, `window` tool, `common-area` and `conference-room` library elements, the wall properties panel, the wall edit handles, and the keyboard interactions that touch walls (arrows, Escape, Shift, double-click). I did NOT touch any source code; this report only describes behavior I observed and reasoned about from the existing implementation.

The user's quote was: *"It is currently frustrating to get the proper design of an office floor plan using our tools."* I treat that as the load-bearing signal of the report. Everything below is in service of explaining specifically WHERE that frustration is coming from.

---

## Top frustrations (ranked by user impact)

These are ordered by frequency of occurrence in a real floor-plan task multiplied by how badly each one breaks the user's mental model. The first three are the ones that make the product feel broken; the rest are friction that compounds.

1. **A placed wall cannot be moved by dragging its body.** The wall accepts a click, "selects" (you see vertex + midpoint handles), and the cursor changes — but if you press on the wall stroke and drag, nothing persistent happens. The wall snaps back to where it was on release. The only ways to reposition a wall are (a) drag its individual vertex handles one at a time, (b) arrow-key nudge after selecting it, or (c) delete and redraw. **For anyone copying an existing floor plan, this is the single most frustrating thing in the editor.**
2. **Walls do not snap to other walls.** The wall tool only snaps to the grid. When the user draws a second wall whose endpoint should meet an existing wall's endpoint, the new endpoint lands on a grid intersection that is *near* — but not on — the existing endpoint. The two walls render as visibly separated; the resulting "room" leaks at every corner. There is no endpoint-snap, no edge-snap, no perpendicular-snap, no "extend to wall" snap.
3. **No angle constraint while drawing.** Holding Shift does nothing while the wall tool is active. There is no 0/45/90° lock, no "ortho mode," no per-segment angle readout. Drawing a perfectly horizontal wall depends on the user being on grid AND keeping the cursor on the same Y row — easy to drift by 1px. Walls drawn freehand are visibly off-axis.
4. **Doors and windows cannot be repositioned on the canvas.** Once placed, a door is selectable and visible — but it is intentionally **not draggable**. The only way to slide a door along a wall is to open the right-hand properties panel and move a `Position on wall` slider from 0..1. There is no on-canvas handle. Worse: the slider gives no length feedback (`0.43` of what?), and dragging the door body simply produces no response.
5. **Deleting a wall silently orphans every door and window attached to it.** The delete path doesn't cascade and doesn't warn. After deleting a wall, attached doors and windows still exist in the document, but their `parentWallId` references nothing. The properties panel for an orphaned door reads `Attached to wall: — (orphan)`. They take up space in selection, in counts, and in exports — but they don't render anywhere reasonable.
6. **No "draw a room" affordance.** The user has to draw four wall segments to make a rectangular room, and ten or more for an L-shape. There is no "rectangular room" tool, no "drag from library to make a 4-walled room," and no closed-polygon mode in the wall tool itself. The architectural mental model — "I want a 12×15 conference room here" — has no first-class verb.
7. **The bulge / curve interaction is hidden and unforgiving.** Curves are produced by *click-dragging* mid-segment during the draw — but the tool's tooltip only says "Click and drag to draw a straight wall," there is no visual hint that drag = arc, and the bulge auto-clamps to chord/2 with no guide. After placement, the curve magnitude can only be re-edited by dragging the green midpoint handle, with no numeric input. Most users will not discover this exists.
8. **`Conference Room` and `Common Area` from the library are colored boxes, not rooms made of walls.** A user who drags "Conference Room" from the Rooms section gets a yellow rectangle with rounded corners. It has no walls. It cannot have a door or window attached. It does not connect to the wall tool's geometry at all. So the user — who just wants "a conference room" — is forced to choose between (a) a labeled box with a capacity number that does not look architectural, or (b) drawing four walls and labeling them themselves, with no capacity tracking. Both are wrong.
9. **Wall tool has no termination feedback.** The session ends on double-click. While drawing a 4-segment room, the user has to remember to double-click — single Enter does not terminate, Escape cancels (and discards). There is no "click on the starting vertex to close" affordance. Closing a polygon is an act of faith.
10. **Wall thickness, line style, and "wall type" are three orthogonal controls with overlapping semantics.** A glass wall (`wallType=glass`) can also be `dashStyle=dashed`. A demountable wall implies dashed but lets the user override. The properties panel lists Thickness, Line style, and Wall type as three independent fields with no preset combinations. Naive users pick "Glass" and a thick stroke and get something that doesn't look like glass.
11. **No way to merge or split walls.** Adjacent collinear wall segments stay as separate elements; there is no "join into one wall" operation. There is no "split this wall here" operation either, so inserting a corner in the middle of a long wall means deleting and redrawing.

---

## Detailed walkthrough

### Drawing a single wall

- **Steps:** Press `W`. Click. Drag. Release. Double-click.
- **What worked:** A blue ghost vertex follows the cursor before the first click, which is a nice cue that the tool is armed. The pending segment shows a real-time length label in the configured scale unit. Snap-to-grid works on press and release.
- **What didn't:**
  - No Shift-to-constrain-angle. Drawing a horizontal wall takes care.
  - The single-segment commit is **double-click**, which means a one-segment wall takes three pointer events (click, click-or-drag-to-second-point, then dblclick). For one wall that's three clicks where two would do.
  - Pressing Escape cancels the in-flight wall and discards every vertex. There is no "undo last vertex" while drawing.
- **Severity:** Medium. It works, but feels heavier than it should.

### Drawing a closed rectangular room

- **Steps:** Click corner 1, click corner 2, click corner 3, click corner 4, double-click to terminate.
- **What worked:** The rubber-band preview shows the dashed pending segment plus the in-progress segments.
- **What didn't:**
  - No way to indicate "close this polygon back to my start vertex." The user has to eyeball the fourth click onto the same coordinate as the first click. Without endpoint snap, the room is almost certainly not closed cleanly.
  - The fourth segment (back to the starting vertex) is committed only by clicking the start point and *then* double-clicking to terminate, which doubles the work and risks placing a stray fifth vertex.
  - No "rectangle room" tool exists at all. Even though Floorcraft already has a `rect-shape` primitive, there's no "draw a 4-walled rectangle room" button anywhere.
- **Severity:** **High.** This is the most common floor-plan operation and the tool actively makes it harder than it needs to be.

### Drawing a curved wall (bulges)

- **Steps:** Press W, click first vertex, click-and-drag away from the chord midpoint, release to commit a curved segment.
- **What worked:** When you do happen to discover this gesture, the live preview shows the arc; the dimension label switches from chord-length to arc-length, which is correct.
- **What didn't:**
  - The interaction is undiscoverable. The Wall tool's first-use tooltip says "Click and drag to draw a straight wall." Nothing tells the user that drag-during-segment makes a curve.
  - There is no numeric "radius" or "angle" input. You can only dial in the curve by eye via the green midpoint handle.
  - Doors and windows cannot be placed on a curved segment at all (`findNearestStraightWallHit` skips arcs). This is correct given the geometry but is never communicated; users will try and the door tool will silently fail to snap.
- **Severity:** Medium for power users (the feature is nicely implemented underneath); high if anyone actually needs curves for a real plan.

### Adding a door

- **Steps:** Press `Shift+D`, hover over a wall, click.
- **What worked:** When the cursor is near a straight wall segment, the door tool snaps the preview to that wall. Click commits.
- **What didn't:**
  - **Once placed, the door is not draggable.** I confirmed this in `ElementRenderer`: door/window elements are explicitly marked `isAttached`, and `groupDraggable = draggable && !isAttached` evaluates to `false`. To slide the door along the wall, the user must select the door, open the properties panel, and move a 0..1 slider. The slider has no unit, no length readout, no "midpoint" snap, and no preview of where on the wall the door will end up.
  - The `Attached to wall` field in properties is the wall's nanoid, displayed in monospace. It is not human-readable and there is no way to navigate to the parent wall from there.
  - Deleting the parent wall does not delete the door.
- **Severity:** **High.** "Place a door, then nudge it 1ft to the left" is a ten-times-an-hour operation in real floor planning. The current model makes it into a slider task.

### Adding a window

- Same shape as adding a door — same snapping, same non-draggability after placement, same orphan-on-wall-delete behavior.
- **Severity:** High (same root cause as doors).

### Moving a wall after placement (single segment)

- **Steps:** Click the wall to select. Press on its body. Drag.
- **What happened:** Konva visually moves the wall during the drag. On release, **the wall snaps back to its original position.** I verified the cause: in `ElementRenderer.tsx`, walls have `ownsPosition = true`, so the wrapping `Group` is rendered at `x=0, y=0` on every render. `handleDragEnd` writes back `{ x, y }` from the drag end pointer — but the very next render forces `x={ownsPosition ? 0 : el.x}`, which clobbers it. Drag is registered, drag has no effect.
- **What the user expected:** They expected a wall to behave like every other element on the canvas — press, drag, release, it's in the new position.
- **Severity:** **Critical.** The single most violated affordance in the product. Users will believe the editor is broken.

### Moving a wall after placement (multi-segment)

- Same as single-segment: the entire wall element is one Group at (0, 0); body drag does nothing.
- The only way to move a multi-segment wall as a unit is to box-select it and arrow-nudge with the keyboard. Even that is awkward — large moves require holding Shift for 10px steps and many keypresses.
- **Severity:** Critical (same root cause).

### Resizing / extending a wall

- **Steps:** Select wall. Look for a resize handle.
- **What happened:** No bounding-box transformer appears for walls. The Transformer in `SelectionOverlay` explicitly excludes wall elements (the comment reads "those don't make sense for walls"). The user can drag a single endpoint vertex via the blue handle, which extends/retracts that segment. There is no "drag the whole wall longer" gesture; there is no length input.
- **Severity:** Medium. Vertex drag works; users just don't expect it as the primary mechanism.

### Deleting a wall that has a door attached

- **Steps:** Click wall. Press Delete.
- **What happened:** Wall is removed. The door remains in the document with `parentWallId` pointing at the deleted ID. `DoorRenderer` reads its world position from the parent wall — with no parent, the door does not render in the canvas. Selecting it from the layers list (if you can find it) shows it as "(orphan)" in the properties panel.
- **What the user expected:** Either (a) the door is deleted with the wall, or (b) the user is asked. Almost no one expects (c) "the door silently becomes a ghost."
- **Severity:** **High.** This is the kind of bug that destroys trust in the tool's data model.

### Combining two adjacent walls into a continuous run

- **Not supported.** There is no "merge walls" operation. Adjacent collinear segments stay as two `WallElement` records. The properties panel and the layer list show them as separate.
- **Severity:** Medium. Users compensate by drawing each room as one continuous wall, but this means a single missed corner-click forces a redraw.

### Splitting a wall mid-segment to insert a corner

- **Not supported.** No split operation exists. To insert a corner mid-wall, the user must delete the wall and redraw two walls.
- **Severity:** Medium. Annoying for plan revisions.

### Drawing a non-rectangular room (pentagon, L-shape)

- **Works.** Click N times then double-click. Combined with the absence of endpoint-snap and angle-lock, the result is rarely clean — but the wall tool itself does support arbitrary polylines.
- **Severity:** Low (in isolation), high (combined with the snap/angle issues above).

### Wall-snap when drawing near existing walls

- **Not implemented.** The only snap during drawing is grid snap. New endpoints do not magnetize to existing vertices, segment midpoints, or perpendicular projections. There is no visual "snap target" badge on hover.
- **Severity:** **High.** This is the single biggest reason rooms don't close cleanly.

### Changing wall thickness, type, dash style

- **Works** through the right-hand properties panel: numeric thickness, dash style dropdown, wall type dropdown.
- **Issues:**
  - Thickness is in canvas units, not the configured scale unit. So a "wall thickness 6" doesn't tell the user "6 inches" — it's just 6 of whatever.
  - The three controls' relationships are not visually grouped or previewed.
  - There is no way to set a *default* thickness or wall type before drawing — every wall is drawn with `thickness: 6, wallType: 'solid'` and then has to be changed afterward.

### Common-area vs walls — when does each make sense?

- The "Common Area" library element is a **filled box** with a label. It is **not made of walls**. It does not have walls. You cannot put a door on it.
- The mental model collision: a user reading the library sees "Common Area," "Conference Room," "Phone Booth" in the Rooms section and assumes these are *rooms* — bounded spaces. They are colored rectangles.
- Real architectural intent: a user wants to *carve* a common area out of the floor by enclosing it with walls and labeling that enclosure "Lounge." The product's affordance is instead "drop a yellow box on the floor."
- **Severity:** **High** — this is a conceptual mismatch, not a bug. Users have to learn an inverted mental model.

### Aligning a wall horizontally / vertically

- After placement, no rotate. No "snap to 90°" command. No "align horizontal" command. The Align/Distribute toolbar doesn't operate on walls. The user can drag the endpoint vertex handles to manually equalize, by eye.
- **Severity:** Medium.

### Nudging a wall by 1px / 10px

- **Works.** Arrow-key nudges shift all `points` by ±1 (or ±10 with Shift). This is, ironically, the only way to actually *move* a wall.
- **Severity:** Low — it works correctly.

### Undoing wall edits

- **Works.** zundo is integrated with the wall edit overlay (drag handles pause/resume so a single drag = one undo step).
- **Severity:** Low — this part is well done.

---

## What I think the underlying conceptual issues are

There are two — and they're stacked.

**1. The product's data model treats walls as line strokes, not as architectural objects.** A `WallElement` is a polyline (`points: number[]`) with a thickness and a stroke style. There's a `connectedWallIds` field on the type, but it is never written to anywhere outside test fixtures — so the model has the *vocabulary* for connectivity but no *implementation* of it. Doors and windows hang off walls via `parentWallId`, but with no inverse relationship maintained on the wall. Conference rooms and common areas are entirely separate elements that don't share geometry with walls at all. The result is that the user — who is reasoning in terms of "rooms made of walls with doors and windows in them" — is actually working against three disconnected primitives that the product asks them to mentally compose.

**2. Walls were given drawing affordances but not editing affordances.** Drawing a wall is a polished interaction (live preview, length label, bulge support, grid snap). After the wall lands on the canvas, almost every editing affordance that exists for other elements is missing or broken: body drag is wired but doesn't persist, Transformer scale/rotate is explicitly disabled, no merge, no split, no extend, no align. The user is left with vertex-handle drag and arrow-key nudge — which is fine for a few touch-ups but disastrous if you laid out the room slightly off and want to scoot it 6 inches.

These two issues compound: the user can't *draw* rooms cleanly (because there's no wall-to-wall snap and no angle lock), AND they can't *fix* the resulting mess (because the editing tools assume per-vertex surgical work). The one papercut they can reasonably solve by hand — endpoint nudging — they have to do via the keyboard, one wall at a time.

This is a "fix one fundamental model" situation more than a "fix a thousand papercuts" situation. The fundamental shift is from *"a wall is a polyline I drew"* toward *"a wall is a structural edge of a room, snapped to other walls, that doors and windows live inside."*

---

## What competitors do better

- **Lucidchart / Whimsical** offer a "rectangle room" library shape that lays down four walls in one drag-out-from-corner gesture, with the wall thickness, label, and dimensions baked in. Floorcraft has nothing similar.
- **AutoCAD LT and SketchUp** have ortho mode (toggle to constrain to 0/45/90°) — universally bound to F8 or Shift. Floorcraft has nothing.
- **Figma** snaps every drag to 1px-precision alignment guides between any pair of objects. Walls in Floorcraft don't participate in alignment guides at all.
- **OfficeRnD and PlanRadar** treat doors and windows as canvas-draggable handles that slide along the parent wall in real time. Floorcraft makes the user open a properties slider.
- **AutoCAD** lets you `EXTEND` a wall to another wall — pick the target, pick the wall, done. Floorcraft has no extend/trim/join verbs at all.

We don't need to match all of these. We need to pick the two or three that the user's "real architectural floor plan" workflow most depends on, which I think are: room as first-class object, ortho mode, and on-wall door/window dragging.

---

## Recommendations (prioritized)

Effort estimates are **rough — engineering will refine them** in the synthesis pass. They're labelled S/M/L/XL where S < 1 day, M = 1–3 days, L = 1 week, XL = multi-week.

### P0 — fix this week

1. **Make placed walls draggable.** Wire `handleDragMove` / `handleDragEnd` so that dragging a wall's body translates every entry in `points` by the drag delta and resets the Group's local x/y to 0. This is one well-scoped path through `ElementRenderer.tsx`. Without this, every other improvement is a band-aid.
   - **What:** body drag of a wall translates all of its `points`.
   - **Why:** the product currently says "I select, I drag, I release, nothing happens." That's the loudest broken affordance in the editor.
   - **Expected impact:** removes the single most-cited frustration in five minutes of use.
   - **Rough effort:** **S** (one component, one helper, plus a regression test).

2. **Add wall-to-wall endpoint snap during drawing.** When the in-flight wall's pending vertex is within ~12 canvas px of an existing wall vertex (or an existing segment), snap to it and show a magenta dot indicating the snap target. The geometry helper already exists (`findNearestStraightWallHit`) — wire the same logic into `useWallDrawing.handleCanvasMouseUp`.
   - **Why:** rooms don't close cleanly today; this is the difference between "looks like a floor plan" and "looks like a sketch."
   - **Expected impact:** the drawn rooms pass a visual check on first attempt instead of fifth.
   - **Rough effort:** **M**.

3. **Cascade-delete doors and windows when their parent wall is removed.** In `removeElement` / `removeElements`, find every door/window whose `parentWallId` is in the removed set and remove them too. Bonus: surface a single toast — "3 attached doors and 1 window removed with the wall." with an Undo button (zundo already supports this).
   - **Why:** orphan elements are silent data corruption from the user's perspective.
   - **Expected impact:** restores trust in the data model.
   - **Rough effort:** **S**.

### P1 — next sprint

4. **Ortho mode.** Holding Shift while drawing a wall snaps the pending segment to the nearest 0/45/90° from the previous vertex. Industry-standard. Show a small "ORTHO" pill in the status bar when active.
   - **Effort: S.**
5. **On-canvas drag of doors and windows along their parent wall.** Make `DoorRenderer` and `WindowRenderer` draggable; intercept drag and recompute `positionOnWall` from the projected pointer. Snap to wall midpoint and to any other door/window on the same wall.
   - **Effort: M.**
6. **"Rectangular room" tool / library item.** A new tool (or a library tile in Rooms) that drag-creates a 4-walled rectangle in one gesture, with editable dimensions and a name field. The walls are real `WallElement`s with their endpoints connected, so doors and windows can attach.
   - **Effort: M.**
7. **Replace `Conference Room` and `Common Area` filled boxes with wall-bounded rooms.** Same primitive as #6, with a baked-in label, capacity, and (for conference rooms) a booking badge. The current colored rectangles become a *visual fallback* only when the user opts out of the wall mode.
   - **Effort: L** (touches roster integration, exports, plan-health checks).
8. **Single Enter / first-vertex-click closes a wall polygon.** Drawing a closed shape today requires a double-click after returning to the starting vertex. Adding "click on the start vertex to close" matches user expectation from every other polygon tool.
   - **Effort: S.**

### P2 — future / not blocking

9. **Wall merge and split.** Right-click → "Merge with adjacent wall" when two walls share an endpoint and lie on the same line. Right-click → "Split here" on a wall mid-point.
   - **Effort: M.**
10. **Wall length numeric input in the properties panel.** When a single straight wall is selected, show its length in the configured scale unit and let the user type a new length (the wall extends along its axis from its first vertex).
    - **Effort: S.**
11. **Express wall thickness in the configured scale unit (inches / cm / m).** Today thickness is in canvas units, divorced from real-world dimensions.
    - **Effort: S.**
12. **Curve hint in the wall first-use tooltip.** Replace "Click and drag to draw a straight wall" with "Click to chain segments. Drag mid-click to add a curve." and add a one-time inline tip the first time a user holds the press.
    - **Effort: S.**
13. **A "select connected walls" command.** Cmd+click a wall vertex to select all walls that share an endpoint — speeds up moving a whole room.
    - **Effort: M.**

---

## What I'm NOT recommending and why

- **A full BIM-style room model with sealed polygons and inferred enclosures.** Tempting, but premature. The user's frustration is "I can't move a wall," not "the room enclosure model is wrong." A room-as-walls primitive (P1 #6) plus drag fix (P0 #1) gets us 80% of the perceived value without rebuilding the geometry layer.
- **Replacing the polyline wall model with a graph-based wall model** (where each wall is an edge in a vertex graph). This is what `connectedWallIds` looks like it was *going* to be. It's the right long-term architecture, but doing it now would block every visible improvement on a multi-week refactor. Keep the polyline model; layer endpoint-snap and merge on top.
- **Removing the bulge/arc feature.** It's polished and serves real users (curved partitions exist in real offices). It's just undiscoverable. Fix the discoverability (P2 #12), don't yank the feature.
- **Adding a `GLASS_DASHED` enum to `wallType`.** The user thinks Type and Style should produce presets, not enumerate every combination. Better fix: in the properties panel, replace the three independent fields with a "Wall preset" picker (Drywall / Glass Partition / Cubicle / Modular Demountable) that sets the three under the hood, with an "Advanced" expander to tweak.

---

## Open questions for the team

1. **Is `connectedWallIds` going to be the basis of a future graph model, or should we delete the field?** It currently exists in the type, is initialized to `[]` everywhere, is never read or written outside test fixtures, and is asserted on in migration tests. If it's aspirational, we should either implement it or drop it — leaving it dangling makes future work harder.
2. **What's the canonical real-world unit for wall thickness?** I'd push for "configured scale unit" (so a US user sees inches), but plan exports may need a normalized internal value.
3. **Should the Conference Room library element keep its filled-box rendering as a fallback, or fully migrate to a walls-bounded room?** This affects the autosave migration story.
4. **For door/window drag-to-reposition, do we want the door to be allowed to cross onto an adjacent wall via the connected vertex (when those connections exist) or stay clamped to its parent wall's segment?** I'd start with the simpler "clamped" behavior and revisit.
5. **Is there an architectural-style import format the user is converting *from* (Revit, AutoCAD DXF, OmniGraffle, image)?** That changes which P0/P1 items matter most. If they're tracing from a backdrop image, calibration + ortho mode + endpoint-snap are the top three. If they're recreating from spec, dimension input becomes more important.
