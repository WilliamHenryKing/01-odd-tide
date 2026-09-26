# ODD TIDE — somewhere between here and the sea

26 September 2026. Original fictional retreat; sole-agent design and self-review.

## The idea

An island that changes its mind twice a day. Visitors turn the island's time instrument, watch a real route disappear beneath the water, choose a small place to stay and arrange a day that actually works. A welcoming, slightly eccentric coastal atlas, with tactile architectural miniatures and generous, expressive type.

The remembered action is turning time until the Borrowed Bath's stepping stones emerge. The same model must decide whether an activity can be reached for its entire booked interval. A label-only tide effect fails the idea.

## Art decision and studies

Three actual browser studies compared daylight, apricot afternoon and blue hour using the same coast, cabins and causeway. Daylight at 09:00 was chosen for arrival: it gives the clearest terrain/room separation and starts with an open path. Apricot light remains an intermediate day state, and blue hour supplies the warmer interior and lighthouse payoff. The saved studies are in `output/playwright/study-*.png`. These were visually reviewed as images; functionality was exercised separately.

An oversized Young Serif masthead gives the island a carved, soft-edged personality; DM Sans keeps menus and the itinerary precise. Typography is self-hosted under OFL. Use marine ink, shell cream, rust coral and a luminous lagoon. The site must not inherit Ulcombe's editorial panes or workshop composition.

## Frames and spatial construction

Arrival: full-width coastal water, large ODD TIDE mark at upper left, a small handwritten-like invitation, and a richly layered archipelago across the centre/right. The time instrument sits below the world. The scene and headline should feel like one travel poster, with clear space around the island silhouette. Avoid a boxed canvas next to a dashboard.

Working view: island remains available while an accessible travel ledger below it lets visitors compare three stays, inspect a cabin and plan the day. Scene selections move between composed cameras rather than unrestricted orbit controls. On portrait, stack masthead, tall island view, time control and journal; use a separate camera, larger buildings and readable controls. No drag gesture traps normal page scrolling.

Payoff: the selected cabin at dusk, its roof settled back into place, with the day written on a tear-off postcard. A clearly labelled demo summary appears as a finished itinerary, with a route to edit every selection.

Terrain uses two or three layered irregular coastal islets with softened cliff silhouettes, visible strata, sandy shelves and grouped vegetation. Rock colour varies by face and height. Repeated props use instancing where useful. Cabin walls have boards and visible supports; roofs have rounded glazed tile courses and real hinge origins. Interiors contain a bed/daybed, rug, lamp, books and window trim, visible when the roof lifts. Tiny objects have a visual purpose, not random scatter.

Three stays: Weather House (reading A-frame, sleeps 2), Nap Observatory (round star cabin, sleeps 2), and Lantern Lodge (boardwalk family cabin, sleeps 4). Borrowed Bath is a tidal landmark/activity, not a fourth stay. A floating deck tracks water height. Lanterns come on in an authored sequence as daylight falls. Lens fragments belong to bath, weather vane and observatory sight lines.

## Materials, light and camera

Materials: matte layered sandstone, coarse grass, brushed grey-green boards, rough concrete footings, glazed terracotta ceramic, small polished brass fittings, warm translucent windows. Build texture detail in original code, using stable world/local coordinates and scale. Avoid noise that swims with the camera. Terrain and buildings need shadow/contact separation and edge highlights.

Water: physically located plane rises/falls, with restrained procedural ripples, subtle bands/foam around the island, light scattering colour and visible shallows. Water cannot obscure essential labels or cost hundreds of draw calls. Use a clear depth/order strategy, no z-fighting between decorative bands.

One warm directional key with PCF shadows, cool hemisphere fill and a procedural studio environment for ceramic/glass response. AgX is an initial choice to be judged in actual renders. Cap pixel ratio, suspend hidden/offscreen rendering and pause ambient movement. Mood changes alter key, environment, sky/water colour, windows and lanterns together. No aggressive bloom.

## Motion board

1. Arrival, about 1.6 s: island settles into its composed frame; masthead and place markers enter with small offsets. Useful navigation is immediately available; returning users can act at once.
2. Turning time: GSAP eases a named visual time value over about 0.8 s; water/deck/light read it. Domain state updates immediately, with labels clearly showing selected time. Fast repeated input replaces the prior tween.
3. Select a stay: 1.4 s camera approach along a deliberate arc, then a 0.9 s roof hinge/lift. Interior lamp brightens only after the room is revealed. Close reverses in order. Reduced motion cuts between composed states.
4. Dusk: lanterns appear down the boardwalk with a short stagger. A pause button stops water/gull/grass decoration without blocking meaningful controls.
5. Complete plan: ledger resolves into a postcard; scene returns to selected stay. No fake reservation, confetti claim or purchased ticket.

All tweens are scoped/killed on unmount; each property has one owner. Three.js scene updates stay outside React's frame-by-frame state. Final motion uses 0.9-second time/roof easing and about 1.4-second camera travel. The observatory uses an overlapping rotary shutter instead of a levitating dome. Portrait and tablet widths through 1100 px use stacked type/world/controls and a camera fitted to the available surface; wide desktop retains the travel-poster composition.

## Journey, data and rules

Routes: `/` island, `/stays` comparison, `/stays/weather-house`, `/stays/nap-observatory`, `/stays/lantern-lodge`, `/plan`, `/summary`, `/about`, and a real not-found view. Direct loads and history work. Route navigation restores focus and cancels obsolete movement.

Dates are calendar dates in a fictional October 2026 sample season, computed in integer days. Check-in must precede check-out; allow 1–7 nights; guests 1–4; rooms enforce their capacity; booked intervals are half-open. Prices are integer rand cents and labelled illustrative. There is no live availability or real tide forecast. No names, email addresses or payments.

Sample tide repeats in the authored day, low at 09:00 and 21:00, high at 15:00. Visitors can explore 06:00–22:00. A causeway access window requires the entire activity to remain within the safe demonstration threshold. Borrowed Bath lasts 60 minutes; Lantern Walk is available from 18:00; observatory visit from 19:00; Weather House reading and rock-pool exploration have their own finite windows. The planner checks access and overlapping activities, explains conflicts and offers a feasible schedule. Suggestions are deterministic, not a hidden service.

Mood plans: wander, slow down, stargaze. Visitors can edit/remove activities and their times. Summary blocks while conflicts, unavailable room/dates or capacity errors remain. Editing a finished summary returns to the same choices. Configuration URL and optional local saving are versioned/validated; malformed storage and disabled storage never crash the site.

Postcard uses a real rendered view where WebGL is available, with local drawing/export only. Optional discovery: three lens fragments with visible clues, reachable without booking; reveal a small lighthouse light once assembled. Never gate useful content behind this discovery.

## Accessibility, recovery and sound

DOM controls are equivalent to scene hotspots. Provide labelled ranges, visible focus, field errors, useful status announcements, skip link and motion control. Menus work by keyboard; dates use native input plus clear sample limits. Touch targets remain comfortable at 320 px. No hidden fixed-bar focus stops.

A real scene capture/poster stays visible until a successful first frame. Render failure keeps stays/planner useful, with retry and a clear explanation. Reduced motion avoids camera travel and perpetual animation but permits direct state changes. Visibility/offscreen suspension, context loss and disposal are tested.

Sound is optional original procedural ambience (water and soft buoy chime), started only on a deliberate press with mute/volume control. Full journey works silently. No auto-playing licensed track is needed.

## Verification targets

Meaningful unit cases: calendar boundaries, invalid dates, capacity, blocked availability, price totals, whole-interval tide access, conflicts, auto-repair, URL/storage validation. Browser: all routes and return paths, compare/inspect, conflicts and repair, valid summary, postcard, discovery ending, cold load, reduced motion, context loss, desktop/portrait and keyboard. Screenshots inspect material/contact/type; active interaction checks inspect timing and state. Save honest scope and remaining limitations before any local-complete claim.
