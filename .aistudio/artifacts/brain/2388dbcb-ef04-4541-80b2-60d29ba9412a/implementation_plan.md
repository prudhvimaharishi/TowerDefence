# Crown & Cinder — Grand Scale 3D Battlefield, Complex Winding Paths, Circular Spawn Zones & 360° Orbit Camera

This plan upgrades **Crown & Cinder** from a compact 16×10 board into a full-scale **32×20 3D Real-Time Strategy battlefield** featuring serpentine multi-waypoint paths, radial circular unit deployment zones around your Capital Citadel and forward structures, and a 360-degree rotatable, tiltable, and zoomable tactical camera with an interactive on-screen compass gizmo.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and gameplay decisions incorporate your confirmed preferences from our planning Q&A:

- **Confirmed Decision 1 — Large 32×20 Battlefield with Winding & Branching Paths**: The arena expands 4× in surface area (from 16×10 to 32×20 tiles). Straight horizontal lanes are replaced by multi-waypoint serpentine road networks, S-curve canyon switchbacks, diagonal crossroads, and multi-bridge river/chasm crossings.
- **Confirmed Decision 2 — Radial Circular Unit Spawning (Capital + Forward Outposts)**: Players can deploy units anywhere within a **6.5-tile radial circle** around their Capital Citadel, as well as within **3.5-tile forward deployment rings** projected around any constructed friendly tower, refinery, or captured objective.
- **Confirmed Decision 3 — 360° Camera Orbit, Pitch Tilt, Zoom & Compass Gizmo**: The 3D viewport supports full 360-degree orbital rotation, polar pitch adjustments, camera-relative panning, wide-range zoom, and an interactive on-screen Compass & Camera Gizmo for one-tap orientation and zoom control.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms the tactical experience from a static board layout into a sweeping 3D RTS theatre where players navigate across a 32×20 terrain, construct forward bases to extend their circular troop deployment perimeter, and maneuver armies along winding, interconnected paths.
- **Target Audience / Persona**: Strategy and RTS players on both desktop (mouse + keyboard) and mobile/tablet (touch gestures + thumb HUD) who want spatial depth, flanking tactics, and full 3D camera freedom.
- **Key Value**:
  - **4× Larger Tactical Scale**: Room for deep defensive layering, flanking maneuvers, and multiple contested objectives.
  - **Dynamic Forward Projection**: Building a tower or refinery near a bridge or crossroads extends your circular unit spawn perimeter forward, creating real RTS frontlines.
  - **True 3D Spatial Freedom**: Inspect clashes up close from any angle or zoom out and rotate the battlefield like a commander's war table.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Exploring the 32×20 Battlefield (360° Orbit, Tilt, Zoom & Pan)**:
   - **Mouse Controls**: Left-drag pans across the ground plane relative to the camera's current facing angle; Right-drag (or `Shift` + Left-drag / Middle-drag) orbits 360° horizontally and tilts pitch vertically; Scroll wheel smoothly zooms from close-up troop level (`distance: 10`) to grand strategic overview (`distance: 46`).
   - **Touch Controls**: One-finger drag pans (or orbits when the camera gizmo's Orbit Mode toggle is active); two-finger pinch zooms; two-finger twist rotates the camera around the focal point.
   - **On-Screen Compass & Camera Gizmo**: A sleek floating gizmo in the top-right perimeter HUD displays a live-rotating N/E/S/W compass rose, `↺ 45°` / `↻ 45°` orbit buttons, Pitch Tilt cycler (Isometric / High Tactical / Low Cinematic), Zoom `+` / `-`, and quick-snap presets (`My Citadel`, `Center Crucible`, `Full Map`, `Reset North`).

2. **Circular Unit Deployment (Capital Ring + Forward Outpost Rings)**:
   - When the player selects a troop card (`Paladin`, `Arbalest`, `Siege Ram` or hotkeys `Q`/`W`/`E`), the 3D terrain illuminates **glowing radial deployment rings**:
     - A primary **6.5-tile radius circle** centered on the player's Capital Citadel.
     - Secondary **3.5-tile radius circles** centered on each friendly constructed building (Refineries, Cannon Towers, Arc Spires) and any friendly-captured neutral Siphon.
   - Hovering or tapping anywhere inside these circular zones displays a 3D unit ghost preview with a directional arrow pointing toward the nearest winding path waypoint.
   - Clicking/tapping any non-obstructed point inside any friendly spawn circle immediately deploys the unit at that exact `(x, z)` coordinate. Quick-deploy lane buttons on the troop cards remain available for instant 1-tap deployment at the forward edge of the Capital's spawn ring.

3. **Multi-Waypoint Winding & Branching Paths**:
   - **Ironhold Chasm (32×20 Volcanic Fortress Gorge)**:
     - Features 3 primary winding routes (**North High Switchback**, **Central Crucible Approach**, and **South Shadow Serpentine**) plus diagonal mid-map crossroads and **3 Contested Objectives** (the central *Grand Sovereign Siphon* at `(16, 10)` and two flanking *Outpost Gold Shrines* on the North and South plateaus).
   - **Twin Bridges — Riverlands Valley (32×20 Expanded Meadow)**:
     - Features serpentine cobblestone highways that wind around forest groves and rock outcrops, crossing over a northern stone arch bridge, a central island ford, and a southern timber bridge.

### Visual Identity & Theme

- **Aesthetic Direction**: High-craft stylized 3D tabletop-meets-grand-RTS war theatre with crisp physically-based materials, procedural stone/turf/magma textures, and unobstructed perimeter HUD ergonomics.
- **Color Palette & Mood**:
  - **Royal Faction (West)**: Cobalt blue (`#2563EB`), sunlit emerald turf / ashlar slate, warm gold trim (`#F59E0B`), and sky-blue radial spawn rings (`#38BDF8`).
  - **Infernal Faction (East)**: Crimson obsidian (`#DC2626`), volcanic basalt, molten magma fissures (`#EA580C`), and ember-red radial spawn rings (`#F87171`).
  - **HUD Surfaces**: High-contrast crisp light slate (`rgba(255, 255, 255, 0.95)`) with `1px` structural borders (`#E2E8F0`), zero `backdrop-filter` blur over the active WebGL canvas for maximum frame rate, and tabular numerals (`tabular-nums`).
- **Typography & Hierarchy**:
  - **Display & Faction Headers**: `Cinzel` (Bold/Black) for heroic titles and map names.
  - **UI Controls & Tactical Labels**: Clean geometric sans-serif (`Plus Jakarta Sans` / system sans) with single-line `whitespace-nowrap` discipline.
  - **Telemetry & Economy**: Monospace `tabular-nums` for gold counters, match clock, HP readouts, and coordinate indicators.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Spherical Camera Rig (`target` + `theta` + `phi` + `distance`) with Exponential Damping**
  - *Chosen Approach*: Replace fixed-offset camera positioning with a damped spherical coordinate rig around a movable ground-plane look-at target (`targetLookAt`). Panning translates `targetLookAt` along the camera's current horizontal forward/right basis vectors.
  - *Why*: Ensures that after rotating the camera 90° or 180°, dragging the map pans naturally in screen space without inverted or disorienting axes, while smoothly interpolating preset snaps (`My Base`, `Full Map`, `Reset North`).
  - *Alternatives Considered*: Raw `OrbitControls` without custom pan/click disambiguation was passed over becauseRTS tile clicking, unit ghost placement, and drag-panning require tight pointer-distance thresholds (`< 6px` click vs. drag).

- **Decision 2: Continuous Radial Distance Validation for Unit Spawning**
  - *Chosen Approach*: Validate unit spawns using Euclidean distance from the center of the player's Capital (`dist <= 6.5`) OR any friendly building (`dist <= 3.5`) OR friendly-owned objective (`dist <= 3.5`), while excluding chasm/river hazard tiles.
  - *Why*: Gives players authentic circular placement freedom around their base and rewards building forward towers with expanded tactical deployment zones.
  - *Alternatives Considered*: Restricting spawns to discrete rectangular grid columns felt like a rigid board game and lacked tactical forward-base progression.

- **Decision 3: Multi-Waypoint Polyline Pathfinding with Dynamic Aggro Leashing**
  - *Chosen Approach*: Define each lane as an ordered sequence of 2D waypoints (`waypoints: { x: number; z: number }[]`) from West to East (reversed for Infernal). Units track their current `waypointIndex`, advancing to the next node as they march, dynamically stepping off-path to engage enemies within aggro range (`4.5` tiles), and resuming progress toward the next forward waypoint afterward.
  - *Why*: Delivers visually rich S-curves, diagonal flanking routes, and bridge funnels at 20 Hz server/client tick rates with deterministic multiplayer synchronization.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        React Application Shell (App)                       │
├───────────────────────┬────────────────────────────┬───────────────────────┤
│   TopPerimeterHUD     │   3D WebGL Viewport        │  BottomCommandDock    │
│  ┌─────────────────┐  │  (ThreeSceneManager)       │ ┌───────────────────┐ │
│  │ Citadel HP Bars │  │  ┌──────────────────────┐  │ │ Build / Troops /  │ │
│  │ Gold & Clock    │  │  │ Spherical Camera Rig │  │ │ Armory Tabs       │ │
│  │ Objective Status│  │  │ (Orbit/Tilt/Zoom/Pan)│  │ ├───────────────────┤ │
│  ├─────────────────┤  │  ├──────────────────────┤  │ │ 1-Tap Lane Deploy │ │
│  │ Compass &       │  │  │ 32x20 Terrain &      │  │ │ & Radial Map      │ │
│  │ Camera Gizmo    │  │  │ Winding Path Meshes  │  │ │ Placement Mode    │ │
│  │ (360° / Tilt /  │  │  ├──────────────────────┤  │ ├───────────────────┤ │
│  │  Zoom / Presets)│  │  │ Radial Spawn Rings   │  │ │ Building Upgrade  │ │
│  └─────────────────┘  │  │ (Capital + Outposts) │  │ │ & Demolish Popover│ │
│                       │  └──────────────────────┘  │ └───────────────────┘ │
└───────────┬───────────┴──────────────┬─────────────┴───────────┬───────────┘
            │                          │                         │
            ▼                          ▼                         ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                Shared Deterministic Simulation Engine                      │
│  ┌────────────────────────┐  ┌──────────────────────┐  ┌────────────────┐  │
│  │ 32x20 Grid & Territory │  │ Circular Spawn Zone  │  │ Multi-Waypoint │  │
│  │ Building Validation    │  │ Euclidean Validator  │  │ Path Follower  │  │
│  └────────────────────────┘  └──────────────────────┘  └────────────────┘  │
└──────────────────────────────────────┬─────────────────────────────────────┘
                                       │
                         ┌─────────────┴─────────────┐
                         ▼                           ▼
              ┌────────────────────┐      ┌────────────────────┐
              │ Local AI Loop      │      │ Multiplayer WS     │
              │ (Solo Commander)   │      │ Server (20Hz Sync) │
              └────────────────────┘      └────────────────────┘
```

### Data Model & State Strategy

- **Expanded Grid & Territory Constants**:
  - `GRID_COLS = 32`, `GRID_ROWS = 20`
  - Royal West Territory: `X: 0..12`, Capital centered at `(3, 9)` (2×2 footprint `gridX: 2, gridZ: 9`)
  - Central Contested Canyon / River Valley: `X: 13..18`
  - Infernal East Territory: `X: 19..31`, Capital centered at `(29, 9)` (2×2 footprint `gridX: 28, gridZ: 9`)
- **Circular Spawn Zone Rules**:
  - `CAPITAL_SPAWN_RADIUS = 6.5` tiles around `(capital.gridX + 1, capital.gridZ + 1)`
  - `BUILDING_SPAWN_RADIUS = 3.5` tiles around `(building.gridX + 0.5, building.gridZ + 0.5)` for any friendly building or owned neutral objective.
  - Helper `getValidSpawnCircles(state, faction)` returns all active `{ x, z, radius }` circles for both rules validation and 3D terrain ring rendering.
  - Helper `canSpawnUnitAtPosition(state, faction, x, z)` verifies that `(x, z)` lies within map bounds, is not inside river/chasm water/lava hazards (unless on a bridge), and lies within at least one friendly spawn circle.
- **Multi-Waypoint Lane Definitions (`LaneDef`)**:
  - Each `LaneDef` includes `waypoints: Array<{ x: number; z: number }>` (8–10 points per route weaving through territory roads, switchbacks, bridges, and junctions).
  - `UnitState` tracks `waypointIndex: number` so units smoothly progress from node to node toward the enemy Capital Citadel.
  - When a unit is spawned at an arbitrary `(x, z)` inside a circular zone, `findNearestLaneAndWaypoint(mapId, faction, x, z)` assigns the closest lane and the best forward waypoint index so the unit immediately marches forward along the nearest path.

### Interactive Component & State Mapping

- **Camera Orbit & Compass Gizmo (`TopPerimeterHUD` ↔ `ThreeSceneManager`)**:
  - Rotating the camera updates a live angle callback (`onCameraChange(azimuthDeg, pitchDeg, zoomPct, orbitMode)`), rotating the SVG compass needle in real time.
  - Clicking `↺ 45°`, `↻ 45°`, `Reset North`, `Tilt`, `Zoom +`, `Zoom -`, `My Base`, or `Full Map` invokes damped spherical target updates on `ThreeSceneManager`.
  - Toggling **Orbit Mode** on the gizmo switches primary single-finger/left-click drag between Pan and 360° Orbit for effortless touch/trackpad rotation.
- **3D Radial Spawn Visualization (`ThreeSceneManager`)**:
  - Renders animated runic ground circles around the player's Capital and forward buildings whenever the `Troops` tab is active or a unit placement is armed, giving instant visual feedback on where units can be deployed.
