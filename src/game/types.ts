/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Faction = 'royal' | 'infernal';

export type BuildingType = 'capital' | 'barracks' | 'refinery' | 'cannon_tower' | 'arc_spire';

export type UnitType = 'melee' | 'ranged' | 'siege';

export type Lane = 'north' | 'center' | 'south';

export type MapId = 'twin_bridges' | 'ironhold_chasm';

export interface Waypoint {
  x: number;
  z: number;
}

export interface SpawnCircle {
  x: number;
  z: number;
  radius: number;
  sourceType: 'capital' | 'building' | 'objective';
  label?: string;
}

export interface NeutralObjectiveState {
  id: string;
  type: 'sovereign_core';
  name: string;
  x: number;
  z: number;
  radius: number;
  owner: Faction | null;
  captureProgress: number; // -100 (infernal) to +100 (royal), 0 = neutral
  goldTickRate: number;
  goldPerTick: number;
  productionTimer: number;
}

export interface LaneDef {
  id: Lane;
  name: string;
  shortLabel: string;
  desc: string;
  bridgeZ: number;
  waypoints: Waypoint[];
}

export interface MapDef {
  id: MapId;
  name: string;
  badge: string;
  subtitle: string;
  description: string;
  tacticalNotes: string;
  lanes: LaneDef[];
  crossPaths: Waypoint[][];
  theme: 'meadow' | 'chasm';
}

// Grand 32 wide (X: 0..31), 20 deep (Z: 0..19) Open-Field RTS Forest Battlefield
export const GRID_COLS = 32;
export const GRID_ROWS = 20;

// Territory boundaries (West: 0..12, Contested Forest Midfield: 13..18, East: 19..31)
export const ROYAL_MIN_X = 0;
export const ROYAL_MAX_X = 12;
export const INFERNAL_MIN_X = 19;
export const INFERNAL_MAX_X = 31;

// Castle Keep default coordinates (2x2 footprint)
export const ROYAL_CAPITAL_X = 2;
export const ROYAL_CAPITAL_Z = 9;
export const INFERNAL_CAPITAL_X = 28;
export const INFERNAL_CAPITAL_Z = 9;

// Starting Barracks default coordinates (1x1 footprint beside Castle)
export const ROYAL_BARRACKS_X = 5;
export const ROYAL_BARRACKS_Z = 9;
export const INFERNAL_BARRACKS_X = 26;
export const INFERNAL_BARRACKS_Z = 9;

// Radial Circular Unit Spawn Radii
export const CAPITAL_SPAWN_RADIUS = 6.5;
export const BUILDING_SPAWN_RADIUS = 4.0;
export const OBJECTIVE_SPAWN_RADIUS = 3.8;

// Crossing Z centers on 32x20 grid
export const NORTH_BRIDGE_Z = 3;
export const CENTER_BRIDGE_Z = 10;
export const SOUTH_BRIDGE_Z = 17;

export const MAP_DEFS: Record<MapId, MapDef> = {
  twin_bridges: {
    id: 'twin_bridges',
    name: 'Silverpine Glade',
    badge: 'LOW-POLY FOREST',
    subtitle: 'Open Woodland Valley, Shallow Fords & Twin Castles',
    description:
      'A sunlit low-poly emerald forest valley flanked by pine ridges, mossy boulders, and two opposing stone Castles.',
    tacticalNotes:
      'Barracks continuously train troops that wait at your rally point. Drag a box to select troops and click anywhere on the forest floor to march and attack!',
    theme: 'meadow',
    lanes: [
      {
        id: 'north',
        name: 'Northern Pine Clearing',
        shortLabel: '▲ North',
        desc: 'Northern woodland clearing across the mossy stone ford',
        bridgeZ: 3.5,
        waypoints: [
          { x: 6.5, z: 7.5 },
          { x: 16.0, z: 3.5 },
          { x: 25.5, z: 7.5 },
        ],
      },
      {
        id: 'center',
        name: 'Ancient Grove Meadow',
        shortLabel: '◆ Center',
        desc: 'Direct central forest meadow through the Elder Gold Shrine',
        bridgeZ: 10.0,
        waypoints: [
          { x: 7.0, z: 10.0 },
          { x: 16.0, z: 10.0 },
          { x: 25.0, z: 10.0 },
        ],
      },
      {
        id: 'south',
        name: 'Southern Oak Hollow',
        shortLabel: '▼ South',
        desc: 'Southern forest hollow crossing the timber woodland bridge',
        bridgeZ: 16.5,
        waypoints: [
          { x: 6.5, z: 12.5 },
          { x: 16.0, z: 16.5 },
          { x: 25.5, z: 12.5 },
        ],
      },
    ],
    crossPaths: [],
  },
  ironhold_chasm: {
    id: 'ironhold_chasm',
    name: 'Kingswood Highlands',
    badge: 'CASTLE SIEGE RTS',
    subtitle: 'Low-Poly Highland Forest, Ancient Shrines & Fortress Keeps',
    description:
      'An expansive low-poly highland forest where Royal and Crimson Castles clash across three ancient runic forest shrines.',
    tacticalNotes:
      'Build Barracks to automatically muster squads. Box-select waiting troops and point where to march—units engage any enemies in their vicinity!',
    theme: 'chasm',
    lanes: [
      {
        id: 'north',
        name: 'North Highland Ridge',
        shortLabel: '▲ North',
        desc: 'Northern highland forest pass and Runic Shrine',
        bridgeZ: 3.0,
        waypoints: [
          { x: 6.5, z: 7.5 },
          { x: 16.0, z: 3.0 },
          { x: 25.5, z: 7.5 },
        ],
      },
      {
        id: 'center',
        name: 'Kingswood Clearing',
        shortLabel: '◆ Center',
        desc: 'Wide central forest clearing through the Sovereign Gold Shrine',
        bridgeZ: 10.0,
        waypoints: [
          { x: 7.0, z: 10.0 },
          { x: 16.0, z: 10.0 },
          { x: 25.0, z: 10.0 },
        ],
      },
      {
        id: 'south',
        name: 'South Whispering Woods',
        shortLabel: '▼ South',
        desc: 'Southern timberland pass and Ember Shrine',
        bridgeZ: 17.0,
        waypoints: [
          { x: 6.5, z: 12.5 },
          { x: 16.0, z: 17.0 },
          { x: 25.5, z: 12.5 },
        ],
      },
    ],
    crossPaths: [],
  },
};

export type PlacementSelection =
  | { kind: 'building'; type: BuildingType }
  | { kind: 'unit'; type: UnitType }
  | null;

export interface BuildingDef {
  type: BuildingType;
  name: Record<Faction, string>;
  description: Record<Faction, string>;
  width: number;
  height: number;
  cost: number[]; // [Lv1, Lv2, Lv3]
  maxHp: number[]; // [Lv1, Lv2, Lv3]
  damage?: number[];
  range?: number;
  attackSpeed?: number; // seconds between attacks
  goldTickRate?: number; // seconds between gold generation
  goldPerTick?: number[]; // [Lv1, Lv2, Lv3]
  spawnInterval?: number[]; // [Lv1, Lv2, Lv3] seconds between automatic troop spawns for barracks
  maxGarrison?: number[]; // [Lv1, Lv2, Lv3] max active auto-spawned troops per barracks
}

export interface UnitDef {
  type: UnitType;
  name: Record<Faction, string>;
  role: string;
  cost: number[]; // [Lv1, Lv2, Lv3]
  upgradeCost: number[]; // Cost to upgrade unit class Lv1->Lv2, Lv2->Lv3
  maxHp: number[];
  damage: number[];
  speed: number; // grid tiles per second
  range: number; // attack range in grid tiles
  aggroRange: number; // vicinity detection range in grid tiles
  attackSpeed: number; // seconds
  targetPriority: 'all' | 'buildings_only';
}

export interface BuildingState {
  id: string;
  faction: Faction;
  type: BuildingType;
  gridX: number;
  gridZ: number;
  level: 1 | 2 | 3;
  hp: number;
  maxHp: number;
  attackCooldown: number;
  productionTimer: number;
  /** For barracks: which unit type it automatically produces and where troops rally */
  producingUnitType?: UnitType;
  rallyX?: number;
  rallyZ?: number;
}

export interface UnitState {
  id: string;
  faction: Faction;
  type: UnitType;
  level: 1 | 2 | 3;
  x: number;
  z: number;
  lane: Lane;
  waypointIndex: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  range: number;
  aggroRange?: number;
  attackSpeed: number;
  attackCooldown: number;
  targetId: string | null;
  targetKind: 'building' | 'unit' | null;
  /** RTS destination where unit walks and then waits if no enemy is in vicinity */
  targetPos?: { x: number; z: number } | null;
  /** Home/rally position where unit waits when idle */
  guardPos?: { x: number; z: number };
  /** Optional source barracks ID */
  barracksId?: string;
  state: 'idle' | 'moving' | 'marching' | 'attacking' | 'ko';
  koTimer: number;
}

export interface ProjectileState {
  id: string;
  sourceX: number;
  sourceZ: number;
  sourceY: number;
  targetX: number;
  targetZ: number;
  targetY: number;
  targetId: string;
  targetKind: 'building' | 'unit';
  damage: number;
  faction: Faction;
  kind: 'cannon' | 'beam' | 'fireball';
  progress: number; // 0..1
  speed: number;
}

export interface FloatingText {
  id: string;
  x: number;
  z: number;
  text: string;
  color: string;
  lifetime: number;
  maxLifetime: number;
}

export interface PlayerState {
  faction: Faction;
  connected: boolean;
  gold: number;
  totalGoldEarned: number;
  buildingsConstructed: number;
  unitsDeployed: number;
  troopTiers: Record<UnitType, 1 | 2 | 3>;
}

export interface BattleState {
  roomId: string;
  mode: 'ai' | 'multiplayer';
  status: 'waiting' | 'playing' | 'paused' | 'gameover';
  elapsedTime: number;
  winner: Faction | null;
  mapId: MapId;
  players: Record<Faction, PlayerState>;
  buildings: BuildingState[];
  units: UnitState[];
  projectiles: ProjectileState[];
  floatingTexts: FloatingText[];
  neutralObjectives: NeutralObjectiveState[];
}

export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  capital: {
    type: 'capital',
    name: {
      royal: 'Lionheart Castle Keep',
      infernal: 'Dreadspire Fortress',
    },
    description: {
      royal: 'Grand Royal Castle. Armed with defensive ballistae & 6.5-tile command perimeter.',
      infernal: 'Crimson Obsidian Castle. Fires magma bolts & projects a 6.5-tile command perimeter.',
    },
    width: 2,
    height: 2,
    cost: [0, 0, 0],
    maxHp: [2500, 2500, 2500],
    damage: [38, 38, 38],
    range: 6.5,
    attackSpeed: 1.15,
  },
  barracks: {
    type: 'barracks',
    name: {
      royal: 'Royal Garrison Barracks',
      infernal: 'Crimson War Barracks',
    },
    description: {
      royal: 'Continuously trains troops that muster outside and wait for your RTS move orders.',
      infernal: 'Spawns warbands that rally at the courtyard and attack enemies in their vicinity.',
    },
    width: 1,
    height: 1,
    cost: [90, 140, 210],
    maxHp: [650, 950, 1350],
    spawnInterval: [8.5, 6.5, 5.0],
    maxGarrison: [6, 9, 12],
  },
  refinery: {
    type: 'refinery',
    name: {
      royal: 'Woodland Gold Mill',
      infernal: 'Deepwood Ore Siphon',
    },
    description: {
      royal: 'Extracts gold from forest streams & projects a 4.0-tile command ring.',
      infernal: 'Smelts highland gold veins into bullion & projects a 4.0-tile command ring.',
    },
    width: 1,
    height: 1,
    cost: [75, 120, 200],
    maxHp: [450, 700, 1050],
    goldTickRate: 3.5,
    goldPerTick: [18, 32, 54],
  },
  cannon_tower: {
    type: 'cannon_tower',
    name: {
      royal: 'Watchtower Cannon',
      infernal: 'Obsidian Mortar',
    },
    description: {
      royal: 'Stone forest watchtower firing heavy iron shells at nearby enemies.',
      infernal: 'Fortified mortar hurling volcanic slag at approaching enemy squads.',
    },
    width: 1,
    height: 1,
    cost: [100, 160, 240],
    maxHp: [650, 950, 1350],
    damage: [48, 76, 115],
    range: 5.5,
    attackSpeed: 1.4,
  },
  arc_spire: {
    type: 'arc_spire',
    name: {
      royal: 'Sylvan Crystal Spire',
      infernal: 'Brimstone Obelisk',
    },
    description: {
      royal: 'Focuses radiant light into rapid piercing beams across the forest.',
      infernal: 'Channels searing brimstone beams to melt enemy armor.',
    },
    width: 1,
    height: 1,
    cost: [130, 190, 280],
    maxHp: [520, 780, 1120],
    damage: [24, 38, 58],
    range: 6.8,
    attackSpeed: 0.65,
  },
};

export const UNIT_DEFS: Record<UnitType, UnitDef> = {
  melee: {
    type: 'melee',
    name: {
      royal: 'Royal Paladin',
      infernal: 'Crimson Vanguard',
    },
    role: 'Armored frontline knight. Waits at rally point and charges enemies in vicinity.',
    cost: [55, 65, 75],
    upgradeCost: [0, 140, 260],
    maxHp: [290, 430, 640],
    damage: [30, 46, 70],
    speed: 2.55,
    range: 1.15,
    aggroRange: 5.8,
    attackSpeed: 0.9,
    targetPriority: 'all',
  },
  ranged: {
    type: 'ranged',
    name: {
      royal: 'Forest Ranger',
      infernal: 'Ash Pyromancer',
    },
    role: 'Long-range marksman. Attacks enemies entering vicinity from a safe distance.',
    cost: [85, 95, 110],
    upgradeCost: [0, 160, 300],
    maxHp: [190, 280, 400],
    damage: [34, 52, 78],
    speed: 2.25,
    range: 4.8,
    aggroRange: 6.6,
    attackSpeed: 1.2,
    targetPriority: 'all',
  },
  siege: {
    type: 'siege',
    name: {
      royal: 'Oak Battering Ram',
      infernal: 'Iron Juggernaut',
    },
    role: 'Heavy castle-breaker. Demolishes enemy towers, barracks, and Castle Keeps.',
    cost: [150, 175, 200],
    upgradeCost: [0, 220, 400],
    maxHp: [700, 1080, 1600],
    damage: [95, 155, 240],
    speed: 1.75,
    range: 1.5,
    aggroRange: 7.0,
    attackSpeed: 1.8,
    targetPriority: 'buildings_only',
  },
};
