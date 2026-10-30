/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BattleState,
  BuildingState,
  BuildingType,
  BUILDING_DEFS,
  BUILDING_SPAWN_RADIUS,
  CAPITAL_SPAWN_RADIUS,
  Faction,
  GRID_COLS,
  GRID_ROWS,
  INFERNAL_BARRACKS_X,
  INFERNAL_BARRACKS_Z,
  INFERNAL_CAPITAL_X,
  INFERNAL_CAPITAL_Z,
  INFERNAL_MAX_X,
  INFERNAL_MIN_X,
  Lane,
  MapId,
  MAP_DEFS,
  NeutralObjectiveState,
  OBJECTIVE_SPAWN_RADIUS,
  ROYAL_BARRACKS_X,
  ROYAL_BARRACKS_Z,
  ROYAL_CAPITAL_X,
  ROYAL_CAPITAL_Z,
  ROYAL_MAX_X,
  ROYAL_MIN_X,
  SpawnCircle,
  UNIT_DEFS,
  UnitState,
  UnitType,
  Waypoint,
} from './types';

function createUnitInstance(
  faction: Faction,
  unitType: UnitType,
  tier: 1 | 2 | 3,
  x: number,
  z: number,
  rallyX: number,
  rallyZ: number,
  barracksId?: string
): UnitState {
  const def = UNIT_DEFS[unitType];
  return {
    id: `u_${faction}_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    faction,
    type: unitType,
    level: tier,
    x,
    z,
    lane: 'center',
    waypointIndex: 1,
    hp: def.maxHp[tier - 1],
    maxHp: def.maxHp[tier - 1],
    speed: def.speed,
    damage: def.damage[tier - 1],
    range: def.range,
    aggroRange: def.aggroRange,
    attackSpeed: def.attackSpeed,
    attackCooldown: 0.2,
    targetId: null,
    targetKind: null,
    targetPos: null,
    guardPos: { x: rallyX, z: rallyZ },
    barracksId,
    state: 'idle',
    koTimer: 0,
  };
}

/**
 * Computes a non-overlapping formation offset around a rally/destination point
 */
export function getFormationOffset(index: number, total: number): { dx: number; dz: number } {
  if (total <= 1 && index === 0) return { dx: 0, dz: 0 };
  const ring = Math.floor(index / 6) + 1;
  const posInRing = index % 6;
  const countInRing = Math.min(6, Math.max(1, total - (ring - 1) * 6));
  const angle = (posInRing / countInRing) * Math.PI * 2 + ring * 0.4;
  const radius = 0.65 * ring;
  return {
    dx: Math.cos(angle) * radius,
    dz: Math.sin(angle) * radius,
  };
}

export function createInitialGameState(
  roomId = 'LOCAL',
  mode: 'ai' | 'multiplayer' = 'ai',
  mapId: MapId = 'ironhold_chasm'
): BattleState {
  const royalCapital: BuildingState = {
    id: 'cap_royal',
    faction: 'royal',
    type: 'capital',
    gridX: ROYAL_CAPITAL_X,
    gridZ: ROYAL_CAPITAL_Z,
    level: 1,
    hp: BUILDING_DEFS.capital.maxHp[0],
    maxHp: BUILDING_DEFS.capital.maxHp[0],
    attackCooldown: 0,
    productionTimer: 0,
  };

  const infernalCapital: BuildingState = {
    id: 'cap_infernal',
    faction: 'infernal',
    type: 'capital',
    gridX: INFERNAL_CAPITAL_X,
    gridZ: INFERNAL_CAPITAL_Z,
    level: 1,
    hp: BUILDING_DEFS.capital.maxHp[0],
    maxHp: BUILDING_DEFS.capital.maxHp[0],
    attackCooldown: 0,
    productionTimer: 0,
  };

  const royalBarracks: BuildingState = {
    id: 'barracks_royal_init',
    faction: 'royal',
    type: 'barracks',
    gridX: ROYAL_BARRACKS_X,
    gridZ: ROYAL_BARRACKS_Z,
    level: 1,
    hp: BUILDING_DEFS.barracks.maxHp[0],
    maxHp: BUILDING_DEFS.barracks.maxHp[0],
    attackCooldown: 0,
    productionTimer: 5.5, // First auto-spawn happens soon after match starts
    producingUnitType: 'melee',
    rallyX: ROYAL_BARRACKS_X + 2.4,
    rallyZ: ROYAL_BARRACKS_Z + 0.5,
  };

  const infernalBarracks: BuildingState = {
    id: 'barracks_infernal_init',
    faction: 'infernal',
    type: 'barracks',
    gridX: INFERNAL_BARRACKS_X,
    gridZ: INFERNAL_BARRACKS_Z,
    level: 1,
    hp: BUILDING_DEFS.barracks.maxHp[0],
    maxHp: BUILDING_DEFS.barracks.maxHp[0],
    attackCooldown: 0,
    productionTimer: 5.5,
    producingUnitType: 'melee',
    rallyX: INFERNAL_BARRACKS_X - 1.6,
    rallyZ: INFERNAL_BARRACKS_Z + 0.5,
  };

  // Initial garrison units waiting outside each faction's Barracks ready for RTS box-select!
  const initialUnits: UnitState[] = [
    createUnitInstance(
      'royal',
      'melee',
      1,
      royalBarracks.rallyX! + 0.3,
      royalBarracks.rallyZ! - 0.65,
      royalBarracks.rallyX! + 0.3,
      royalBarracks.rallyZ! - 0.65,
      royalBarracks.id
    ),
    createUnitInstance(
      'royal',
      'melee',
      1,
      royalBarracks.rallyX! + 0.3,
      royalBarracks.rallyZ! + 0.65,
      royalBarracks.rallyX! + 0.3,
      royalBarracks.rallyZ! + 0.65,
      royalBarracks.id
    ),
    createUnitInstance(
      'royal',
      'ranged',
      1,
      royalBarracks.rallyX! - 0.55,
      royalBarracks.rallyZ!,
      royalBarracks.rallyX! - 0.55,
      royalBarracks.rallyZ!,
      royalBarracks.id
    ),
    createUnitInstance(
      'infernal',
      'melee',
      1,
      infernalBarracks.rallyX! - 0.3,
      infernalBarracks.rallyZ! - 0.65,
      infernalBarracks.rallyX! - 0.3,
      infernalBarracks.rallyZ! - 0.65,
      infernalBarracks.id
    ),
    createUnitInstance(
      'infernal',
      'melee',
      1,
      infernalBarracks.rallyX! - 0.3,
      infernalBarracks.rallyZ! + 0.65,
      infernalBarracks.rallyX! - 0.3,
      infernalBarracks.rallyZ! + 0.65,
      infernalBarracks.id
    ),
    createUnitInstance(
      'infernal',
      'ranged',
      1,
      infernalBarracks.rallyX! + 0.55,
      infernalBarracks.rallyZ!,
      infernalBarracks.rallyX! + 0.55,
      infernalBarracks.rallyZ!,
      infernalBarracks.id
    ),
  ];

  const neutralObjectives: NeutralObjectiveState[] =
    mapId === 'ironhold_chasm'
      ? [
          {
            id: 'obj_sovereign_core',
            type: 'sovereign_core',
            name: 'Kingswood Gold Shrine',
            x: 16.0,
            z: 10.0,
            radius: 2.8,
            owner: null,
            captureProgress: 0,
            goldTickRate: 2.5,
            goldPerTick: 16,
            productionTimer: 0,
          },
          {
            id: 'obj_north_shrine',
            type: 'sovereign_core',
            name: 'North Runic Glade',
            x: 16.0,
            z: 3.0,
            radius: 2.2,
            owner: null,
            captureProgress: 0,
            goldTickRate: 3.0,
            goldPerTick: 10,
            productionTimer: 0,
          },
          {
            id: 'obj_south_shrine',
            type: 'sovereign_core',
            name: 'South Elder Shrine',
            x: 16.0,
            z: 17.0,
            radius: 2.2,
            owner: null,
            captureProgress: 0,
            goldTickRate: 3.0,
            goldPerTick: 10,
            productionTimer: 0,
          },
        ]
      : [
          {
            id: 'obj_island_shrine',
            type: 'sovereign_core',
            name: 'Ancient Grove Shrine',
            x: 16.0,
            z: 10.0,
            radius: 2.6,
            owner: null,
            captureProgress: 0,
            goldTickRate: 2.8,
            goldPerTick: 14,
            productionTimer: 0,
          },
        ];

  return {
    roomId,
    mode,
    mapId,
    status: 'playing',
    elapsedTime: 0,
    winner: null,
    players: {
      royal: {
        faction: 'royal',
        connected: true,
        gold: 260,
        totalGoldEarned: 260,
        buildingsConstructed: 2,
        unitsDeployed: 3,
        troopTiers: { melee: 1, ranged: 1, siege: 1 },
      },
      infernal: {
        faction: 'infernal',
        connected: mode === 'ai',
        gold: 260,
        totalGoldEarned: 260,
        buildingsConstructed: 2,
        unitsDeployed: 3,
        troopTiers: { melee: 1, ranged: 1, siege: 1 },
      },
    },
    buildings: [royalCapital, infernalCapital, royalBarracks, infernalBarracks],
    units: initialUnits,
    projectiles: [],
    floatingTexts: [],
    neutralObjectives,
  };
}

export function isTileInFactionTerritory(faction: Faction, x: number, z: number): boolean {
  if (z < 0 || z >= GRID_ROWS || x < 0 || x >= GRID_COLS) return false;
  if (faction === 'royal') {
    return x >= ROYAL_MIN_X && x <= ROYAL_MAX_X;
  } else {
    return x >= INFERNAL_MIN_X && x <= INFERNAL_MAX_X;
  }
}

/** Distance from point (px, pz) to line segment (ax, az)-(bx, bz) */
export function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq === 0) return Math.hypot(px - ax, pz - az);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq));
  const projX = ax + t * dx;
  const projZ = az + t * dz;
  return Math.hypot(px - projX, pz - projZ);
}

/**
 * Checks whether a continuous world point (x, z) is in deep unwalkable water/ravine
 * between the wide forest crossings.
 */
export function isPointInHazard(x: number, z: number, mapId: MapId = 'ironhold_chasm'): boolean {
  if (x < 14.2 || x > 17.8) return false;

  if (mapId === 'twin_bridges') {
    // Wide natural forest stone crossings at North (3.5), Center Meadow (10.0), South (16.5)
    if (Math.abs(z - 3.5) <= 2.2) return false;
    if (Math.abs(z - 10.0) <= 3.0) return false;
    if (Math.abs(z - 16.5) <= 2.2) return false;
    return true;
  }

  // Kingswood Highlands wide crossings
  if (Math.abs(z - 3.0) <= 2.2) return false;
  if (Math.abs(z - 10.0) <= 3.2) return false;
  if (Math.abs(z - 17.0) <= 2.2) return false;
  return true;
}

/**
 * Checks if a grid tile (x, z) is in the central stream/ravine zone (X: 13..18) where buildings cannot be placed.
 * Since fixed lane roads are removed in favor of open-field RTS forest terrain, any tile in your territory is buildable!
 */
export function isTileBlockedByBridge(x: number, _z: number, _mapId: MapId = 'ironhold_chasm'): boolean {
  if (x >= 13 && x <= 18) {
    return true;
  }
  return false;
}

export function isTileOccupied(buildings: BuildingState[], x: number, z: number, width = 1, height = 1): boolean {
  for (const b of buildings) {
    const bDef = BUILDING_DEFS[b.type];
    const bW = bDef.width;
    const bH = bDef.height;

    const xOverlap = x < b.gridX + bW && x + width > b.gridX;
    const zOverlap = z < b.gridZ + bH && z + height > b.gridZ;
    if (xOverlap && zOverlap) {
      return true;
    }
  }
  return false;
}

/**
 * Computes all active circular unit spawn/command zones for a faction:
 * - 6.5-tile radial circle around the faction's Castle Keep
 * - 4.0-tile radial circle around each friendly constructed building (Barracks, Towers, Mills)
 * - 3.8-tile radial circle around each friendly-captured neutral shrine
 */
export function getValidSpawnCircles(state: BattleState, faction: Faction): SpawnCircle[] {
  const circles: SpawnCircle[] = [];

  for (const b of state.buildings) {
    if (b.faction !== faction || b.hp <= 0) continue;
    const def = BUILDING_DEFS[b.type];
    const cx = b.gridX + def.width / 2;
    const cz = b.gridZ + def.height / 2;

    if (b.type === 'capital') {
      circles.push({
        x: cx,
        z: cz,
        radius: CAPITAL_SPAWN_RADIUS,
        sourceType: 'capital',
        label: def.name[faction],
      });
    } else {
      circles.push({
        x: cx,
        z: cz,
        radius: BUILDING_SPAWN_RADIUS,
        sourceType: 'building',
        label: def.name[faction],
      });
    }
  }

  if (state.neutralObjectives) {
    for (const obj of state.neutralObjectives) {
      if (obj.owner === faction) {
        circles.push({
          x: obj.x,
          z: obj.z,
          radius: OBJECTIVE_SPAWN_RADIUS,
          sourceType: 'objective',
          label: obj.name,
        });
      }
    }
  }

  return circles;
}

/**
 * Validates whether a unit of `faction` can be spawned at continuous world coordinate `(x, z)`
 * inside any of the faction's circular spawn zones.
 */
export function canSpawnUnitAtPosition(
  state: BattleState,
  faction: Faction,
  x: number,
  z: number
): { ok: boolean; reason?: string; circle?: SpawnCircle } {
  if (x < 0.3 || x > GRID_COLS - 0.3 || z < 0.3 || z > GRID_ROWS - 0.3) {
    return { ok: false, reason: 'Outside battlefield perimeter' };
  }

  if (isPointInHazard(x, z, state.mapId)) {
    return { ok: false, reason: 'Cannot deploy directly into deep water' };
  }

  const circles = getValidSpawnCircles(state, faction);
  for (const c of circles) {
    const dist = Math.hypot(x - c.x, z - c.z);
    if (dist <= c.radius + 0.25) {
      return { ok: true, circle: c };
    }
  }

  return {
    ok: false,
    reason: 'Deploy inside your Barracks or Castle perimeter!',
  };
}

export function findNearestLaneAndWaypoint(
  mapId: MapId,
  faction: Faction,
  x: number,
  z: number,
  preferredLane?: Lane
): { lane: Lane; waypointIndex: number } {
  const mapDef = MAP_DEFS[mapId || 'ironhold_chasm'];
  let bestLane: Lane = preferredLane || (z < 6.5 ? 'north' : z > 13.5 ? 'south' : 'center');
  const chosenLaneDef = mapDef.lanes.find((l) => l.id === bestLane) || mapDef.lanes[0];
  const orderedPts: Waypoint[] =
    faction === 'royal' ? chosenLaneDef.waypoints : [...chosenLaneDef.waypoints].reverse();
  const nextIdx = Math.min(orderedPts.length - 1, 1);
  return { lane: bestLane, waypointIndex: nextIdx };
}

export function canPlaceBuilding(
  state: BattleState,
  faction: Faction,
  type: BuildingType,
  gridX: number,
  gridZ: number
): { ok: boolean; reason?: string } {
  if (state.status !== 'playing') {
    return { ok: false, reason: 'Game is not in active play state' };
  }
  if (type === 'capital') {
    return { ok: false, reason: 'Castle Keep is unique and cannot be placed' };
  }
  const def = BUILDING_DEFS[type];
  const player = state.players[faction];
  const cost = def.cost[0];

  if (player.gold < cost) {
    return { ok: false, reason: `Need ${cost}g (you have ${Math.floor(player.gold)}g)` };
  }

  for (let dx = 0; dx < def.width; dx++) {
    for (let dz = 0; dz < def.height; dz++) {
      const tx = gridX + dx;
      const tz = gridZ + dz;
      if (!isTileInFactionTerritory(faction, tx, tz)) {
        return { ok: false, reason: 'Must build within your forest territory' };
      }
      if (isTileBlockedByBridge(tx, tz, state.mapId)) {
        return { ok: false, reason: 'Cannot build in the central river crossing' };
      }
    }
  }

  if (isTileOccupied(state.buildings, gridX, gridZ, def.width, def.height)) {
    return { ok: false, reason: 'Tile is already occupied' };
  }

  return { ok: true };
}

export function placeBuilding(
  state: BattleState,
  faction: Faction,
  type: BuildingType,
  gridX: number,
  gridZ: number
): { success: boolean; building?: BuildingState; reason?: string } {
  const check = canPlaceBuilding(state, faction, type, gridX, gridZ);
  if (!check.ok) return { success: false, reason: check.reason };

  const def = BUILDING_DEFS[type];
  const player = state.players[faction];
  const cost = def.cost[0];

  player.gold -= cost;
  player.buildingsConstructed += 1;

  const dir = faction === 'royal' ? 1 : -1;
  const newBuilding: BuildingState = {
    id: `b_${faction}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    faction,
    type,
    gridX,
    gridZ,
    level: 1,
    hp: def.maxHp[0],
    maxHp: def.maxHp[0],
    attackCooldown: 0,
    productionTimer: type === 'barracks' ? 5.0 : 0,
    ...(type === 'barracks'
      ? {
          producingUnitType: 'melee',
          rallyX: Math.max(1.5, Math.min(GRID_COLS - 1.5, gridX + 0.5 + dir * 2.2)),
          rallyZ: Math.max(1.5, Math.min(GRID_ROWS - 1.5, gridZ + 0.5)),
        }
      : {}),
  };

  state.buildings.push(newBuilding);

  // If it's a Barracks, immediately spawn 1 starter guard unit that walks out and waits at the rally point!
  if (type === 'barracks') {
    const tier = player.troopTiers.melee;
    const starterUnit = createUnitInstance(
      faction,
      'melee',
      tier,
      gridX + 0.5,
      gridZ + 0.5,
      newBuilding.rallyX!,
      newBuilding.rallyZ!,
      newBuilding.id
    );
    state.units.push(starterUnit);
  }

  return { success: true, building: newBuilding };
}

export function setBarracksConfig(
  state: BattleState,
  faction: Faction,
  buildingId: string,
  producingUnitType?: UnitType,
  rallyX?: number,
  rallyZ?: number
): { success: boolean; reason?: string } {
  const b = state.buildings.find((item) => item.id === buildingId);
  if (!b || b.faction !== faction || b.type !== 'barracks') {
    return { success: false, reason: 'Barracks not found' };
  }
  if (producingUnitType) {
    b.producingUnitType = producingUnitType;
  }
  if (typeof rallyX === 'number' && typeof rallyZ === 'number') {
    b.rallyX = Math.max(0.8, Math.min(GRID_COLS - 0.8, rallyX));
    b.rallyZ = Math.max(0.8, Math.min(GRID_ROWS - 0.8, rallyZ));
  }
  return { success: true };
}

/**
 * RTS Move / Attack-Move Command for a group of selected friendly units.
 * Units walk to formation positions around (destX, destZ); if they find an enemy in vicinity along the way or on arrival, they attack, else they wait there.
 */
export function commandUnitsMove(
  state: BattleState,
  faction: Faction,
  unitIds: string[],
  destX: number,
  destZ: number
): { success: boolean; count: number } {
  const clampedX = Math.max(0.6, Math.min(GRID_COLS - 0.6, destX));
  const clampedZ = Math.max(0.6, Math.min(GRID_ROWS - 0.6, destZ));

  // If player clicked inside deep water, snap destination to nearest walkable bank/crossing
  let finalDestX = clampedX;
  let finalDestZ = clampedZ;
  if (isPointInHazard(finalDestX, finalDestZ, state.mapId)) {
    const crossings = state.mapId === 'twin_bridges' ? [3.5, 10.0, 16.5] : [3.0, 10.0, 17.0];
    let bestZ = crossings[0];
    for (const cz of crossings) {
      if (Math.abs(finalDestZ - cz) < Math.abs(finalDestZ - bestZ)) {
        bestZ = cz;
      }
    }
    finalDestZ = bestZ;
  }

  const validUnits = state.units.filter(
    (u) => u.faction === faction && u.state !== 'ko' && unitIds.includes(u.id)
  );
  if (validUnits.length === 0) return { success: false, count: 0 };

  validUnits.forEach((u, idx) => {
    const { dx, dz } = getFormationOffset(idx, validUnits.length);
    const tx = Math.max(0.6, Math.min(GRID_COLS - 0.6, finalDestX + dx));
    const tz = Math.max(0.6, Math.min(GRID_ROWS - 0.6, finalDestZ + dz));
    u.targetPos = { x: tx, z: tz };
    u.guardPos = { x: tx, z: tz };
    u.targetId = null;
    u.targetKind = null;
    u.state = 'moving';
  });

  return { success: true, count: validUnits.length };
}

export function canUpgradeBuilding(
  state: BattleState,
  faction: Faction,
  buildingId: string
): { ok: boolean; cost: number; nextLevel: 1 | 2 | 3; reason?: string } {
  const building = state.buildings.find((b) => b.id === buildingId);
  if (!building) return { ok: false, cost: 0, nextLevel: 1, reason: 'Building not found' };
  if (building.faction !== faction) return { ok: false, cost: 0, nextLevel: 1, reason: 'Not your building' };
  if (building.type === 'capital') return { ok: false, cost: 0, nextLevel: 1, reason: 'Castle Keep cannot be upgraded' };
  if (building.level >= 3) return { ok: false, cost: 0, nextLevel: 3, reason: 'Already at maximum level' };

  const def = BUILDING_DEFS[building.type];
  const nextLevel = (building.level + 1) as 2 | 3;
  const cost = def.cost[nextLevel - 1];
  const player = state.players[faction];

  if (player.gold < cost) {
    return { ok: false, cost, nextLevel, reason: `Need ${cost}g (you have ${Math.floor(player.gold)}g)` };
  }

  return { ok: true, cost, nextLevel };
}

export function upgradeBuilding(
  state: BattleState,
  faction: Faction,
  buildingId: string
): { success: boolean; reason?: string } {
  const check = canUpgradeBuilding(state, faction, buildingId);
  if (!check.ok) return { success: false, reason: check.reason };

  const building = state.buildings.find((b) => b.id === buildingId)!;
  const player = state.players[faction];
  const def = BUILDING_DEFS[building.type];

  player.gold -= check.cost;
  building.level = check.nextLevel;
  const newMaxHp = def.maxHp[building.level - 1];
  const hpBoost = newMaxHp - def.maxHp[building.level - 2];
  building.maxHp = newMaxHp;
  building.hp = Math.min(newMaxHp, building.hp + hpBoost);

  return { success: true };
}

export function demolishBuilding(
  state: BattleState,
  faction: Faction,
  buildingId: string
): { success: boolean; refund: number; reason?: string } {
  const idx = state.buildings.findIndex((b) => b.id === buildingId);
  if (idx === -1) return { success: false, refund: 0, reason: 'Building not found' };
  const building = state.buildings[idx];
  if (building.faction !== faction) return { success: false, refund: 0, reason: 'Not your building' };
  if (building.type === 'capital') return { success: false, refund: 0, reason: 'Castle Keep cannot be demolished' };

  const def = BUILDING_DEFS[building.type];
  const totalCost = def.cost[building.level - 1];
  const refund = Math.floor(totalCost * 0.5);

  state.players[faction].gold += refund;
  state.buildings.splice(idx, 1);
  return { success: true, refund };
}

export function canDeployUnit(
  state: BattleState,
  faction: Faction,
  unitType: UnitType,
  _lane?: Lane,
  spawnX?: number,
  spawnZ?: number
): { ok: boolean; reason?: string } {
  if (state.status !== 'playing') return { ok: false, reason: 'Game not active' };
  const def = UNIT_DEFS[unitType];
  const player = state.players[faction];
  const tier = player.troopTiers[unitType];
  const cost = def.cost[tier - 1];

  if (player.gold < cost) {
    return { ok: false, reason: `Need ${cost}g (have ${Math.floor(player.gold)}g)` };
  }

  if (typeof spawnX === 'number' && typeof spawnZ === 'number') {
    const posCheck = canSpawnUnitAtPosition(state, faction, spawnX, spawnZ);
    if (!posCheck.ok) {
      return { ok: false, reason: posCheck.reason };
    }
  }

  return { ok: true };
}

/**
 * Spawns a unit from the faction's Barracks (or at a specified valid spawn point)
 * and has it walk to the Barracks rally point and wait there for player RTS orders (or attack enemies in vicinity).
 */
export function deployUnit(
  state: BattleState,
  faction: Faction,
  unitType: UnitType,
  lane: Lane = 'center',
  spawnX?: number,
  spawnZ?: number
): { success: boolean; unit?: UnitState; reason?: string } {
  const check = canDeployUnit(state, faction, unitType, lane, spawnX, spawnZ);
  if (!check.ok) return { success: false, reason: check.reason };

  const def = UNIT_DEFS[unitType];
  const player = state.players[faction];
  const tier = player.troopTiers[unitType];
  const cost = def.cost[tier - 1];

  player.gold -= cost;
  player.unitsDeployed += 1;

  // Find a friendly Barracks to spawn from
  const barracksList = state.buildings.filter((b) => b.faction === faction && b.type === 'barracks' && b.hp > 0);
  const chosenBarracks =
    barracksList.length > 0 ? barracksList[player.unitsDeployed % barracksList.length] : null;

  let originX: number;
  let originZ: number;
  let rallyX: number;
  let rallyZ: number;

  if (typeof spawnX === 'number' && typeof spawnZ === 'number') {
    originX = spawnX;
    originZ = spawnZ;
    rallyX = spawnX;
    rallyZ = spawnZ;
  } else if (chosenBarracks) {
    originX = chosenBarracks.gridX + 0.5;
    originZ = chosenBarracks.gridZ + 0.5;
    const waitingNearBarracks = state.units.filter(
      (u) => u.faction === faction && u.state !== 'ko' && Math.hypot(u.x - (chosenBarracks.rallyX || originX), u.z - (chosenBarracks.rallyZ || originZ)) < 3.2
    ).length;
    const { dx, dz } = getFormationOffset(waitingNearBarracks, waitingNearBarracks + 1);
    const baseRallyX = chosenBarracks.rallyX ?? originX + (faction === 'royal' ? 2.2 : -2.2);
    const baseRallyZ = chosenBarracks.rallyZ ?? originZ;
    rallyX = Math.max(0.8, Math.min(GRID_COLS - 0.8, baseRallyX + dx));
    rallyZ = Math.max(0.8, Math.min(GRID_ROWS - 0.8, baseRallyZ + dz));
  } else {
    const capX = faction === 'royal' ? ROYAL_CAPITAL_X + 1.0 : INFERNAL_CAPITAL_X + 1.0;
    const capZ = faction === 'royal' ? ROYAL_CAPITAL_Z + 1.0 : INFERNAL_CAPITAL_Z + 1.0;
    const dir = faction === 'royal' ? 1 : -1;
    originX = capX + dir * 1.5;
    originZ = capZ;
    rallyX = capX + dir * 3.0 + (Math.random() - 0.5) * 1.4;
    rallyZ = capZ + (Math.random() - 0.5) * 2.2;
  }

  const newUnit = createUnitInstance(
    faction,
    unitType,
    tier,
    originX,
    originZ,
    rallyX,
    rallyZ,
    chosenBarracks?.id
  );
  newUnit.lane = lane;

  state.units.push(newUnit);

  state.floatingTexts.push({
    id: `spawn_${Date.now()}_${Math.random()}`,
    x: originX,
    z: originZ,
    text: `+${def.name[faction]}`,
    color: faction === 'royal' ? '#93C5FD' : '#FCA5A5',
    lifetime: 0,
    maxLifetime: 1.0,
  });

  return { success: true, unit: newUnit };
}

export function canUpgradeTroopTier(
  state: BattleState,
  faction: Faction,
  unitType: UnitType
): { ok: boolean; cost: number; nextTier: 1 | 2 | 3; reason?: string } {
  const player = state.players[faction];
  const currentTier = player.troopTiers[unitType];
  if (currentTier >= 3) return { ok: false, cost: 0, nextTier: 3, reason: 'Already at maximum tech level' };

  const nextTier = (currentTier + 1) as 2 | 3;
  const def = UNIT_DEFS[unitType];
  const cost = def.upgradeCost[nextTier - 1];

  if (player.gold < cost) {
    return { ok: false, cost, nextTier, reason: `Need ${cost}g for tech upgrade (have ${Math.floor(player.gold)}g)` };
  }

  return { ok: true, cost, nextTier };
}

export function upgradeTroopTier(
  state: BattleState,
  faction: Faction,
  unitType: UnitType
): { success: boolean; reason?: string } {
  const check = canUpgradeTroopTier(state, faction, unitType);
  if (!check.ok) return { success: false, reason: check.reason };

  const player = state.players[faction];
  player.gold -= check.cost;
  player.troopTiers[unitType] = check.nextTier;
  return { success: true };
}

/**
 * Step real-time RTS battle simulation for dt seconds
 */
export function stepBattleSimulation(state: BattleState, rawDt: number): void {
  if (state.status !== 'playing') return;

  const dt = Math.min(rawDt, 0.05);
  state.elapsedTime += dt;

  // 1. Passive gold generation, Refinery ticks & Barracks automatic troop production
  for (const faction of ['royal', 'infernal'] as Faction[]) {
    const player = state.players[faction];
    player.gold += dt * 2.4;
    player.totalGoldEarned += dt * 2.4;
  }

  for (const b of state.buildings) {
    if (b.type === 'refinery') {
      const def = BUILDING_DEFS.refinery;
      b.productionTimer += dt;
      const cycle = def.goldTickRate || 3.5;
      if (b.productionTimer >= cycle) {
        b.productionTimer -= cycle;
        const payout = def.goldPerTick![b.level - 1];
        state.players[b.faction].gold += payout;
        state.players[b.faction].totalGoldEarned += payout;

        state.floatingTexts.push({
          id: `ft_${Date.now()}_${Math.random()}`,
          x: b.gridX + 0.5,
          z: b.gridZ + 0.5,
          text: `+${payout}g`,
          color: '#FBBF24',
          lifetime: 0,
          maxLifetime: 1.2,
        });
      }
    } else if (b.type === 'barracks') {
      const def = BUILDING_DEFS.barracks;
      const interval = def.spawnInterval ? def.spawnInterval[b.level - 1] : 8.5;
      const maxGarrison = def.maxGarrison ? def.maxGarrison[b.level - 1] : 6;

      // Count active units from this barracks
      const activeFromBarracks = state.units.filter(
        (u) => u.faction === b.faction && u.state !== 'ko' && u.barracksId === b.id
      ).length;

      if (activeFromBarracks < maxGarrison) {
        b.productionTimer += dt;
        if (b.productionTimer >= interval) {
          b.productionTimer -= interval;
          const uType: UnitType = b.producingUnitType || 'melee';
          const tier = state.players[b.faction].troopTiers[uType];
          const originX = b.gridX + 0.5;
          const originZ = b.gridZ + 0.5;
          const dir = b.faction === 'royal' ? 1 : -1;
          const baseRallyX = b.rallyX ?? originX + dir * 2.2;
          const baseRallyZ = b.rallyZ ?? originZ;

          const { dx, dz } = getFormationOffset(activeFromBarracks, activeFromBarracks + 1);
          const rallyX = Math.max(0.8, Math.min(GRID_COLS - 0.8, baseRallyX + dx));
          const rallyZ = Math.max(0.8, Math.min(GRID_ROWS - 0.8, baseRallyZ + dz));

          const spawned = createUnitInstance(
            b.faction,
            uType,
            tier,
            originX,
            originZ,
            rallyX,
            rallyZ,
            b.id
          );
          state.units.push(spawned);
          state.players[b.faction].unitsDeployed += 1;

          state.floatingTexts.push({
            id: `bspawn_${Date.now()}_${Math.random()}`,
            x: originX,
            z: originZ,
            text: `+${UNIT_DEFS[uType].name[b.faction]}`,
            color: b.faction === 'royal' ? '#93C5FD' : '#FCA5A5',
            lifetime: 0,
            maxLifetime: 1.1,
          });
        }
      }
    }
  }

  // 1b. Neutral Shrine Contestation & Income
  if (state.neutralObjectives && state.neutralObjectives.length > 0) {
    for (const obj of state.neutralObjectives) {
      let royalCount = 0;
      let infernalCount = 0;

      for (const u of state.units) {
        if (u.state === 'ko') continue;
        const dist = Math.hypot(u.x - obj.x, u.z - obj.z);
        if (dist <= obj.radius) {
          if (u.faction === 'royal') royalCount++;
          else infernalCount++;
        }
      }

      if (royalCount !== infernalCount) {
        const delta = (royalCount - infernalCount) * dt * 45;
        obj.captureProgress = Math.max(-100, Math.min(100, obj.captureProgress + delta));

        if (obj.captureProgress >= 100 && obj.owner !== 'royal') {
          obj.owner = 'royal';
          state.floatingTexts.push({
            id: `claim_${Date.now()}_${Math.random()}`,
            x: obj.x,
            z: obj.z,
            text: `${obj.name} Captured!`,
            color: '#60A5FA',
            lifetime: 0,
            maxLifetime: 1.8,
          });
        } else if (obj.captureProgress <= -100 && obj.owner !== 'infernal') {
          obj.owner = 'infernal';
          state.floatingTexts.push({
            id: `claim_${Date.now()}_${Math.random()}`,
            x: obj.x,
            z: obj.z,
            text: `${obj.name} Captured!`,
            color: '#F87171',
            lifetime: 0,
            maxLifetime: 1.8,
          });
        }
      }

      if (obj.owner) {
        obj.productionTimer += dt;
        if (obj.productionTimer >= obj.goldTickRate) {
          obj.productionTimer -= obj.goldTickRate;
          state.players[obj.owner].gold += obj.goldPerTick;
          state.players[obj.owner].totalGoldEarned += obj.goldPerTick;

          state.floatingTexts.push({
            id: `obj_gold_${Date.now()}_${Math.random()}`,
            x: obj.x,
            z: obj.z,
            text: `+${obj.goldPerTick}g`,
            color: obj.owner === 'royal' ? '#93C5FD' : '#FCA5A5',
            lifetime: 0,
            maxLifetime: 1.2,
          });
        }
      }
    }
  }

  // 2. Building attacks (Cannon, Arc Spire, Castle Keep)
  for (const b of state.buildings) {
    b.attackCooldown = Math.max(0, b.attackCooldown - dt);
    const def = BUILDING_DEFS[b.type];
    if (!def.damage || !def.range || !def.attackSpeed) continue;

    if (b.attackCooldown <= 0) {
      const enemyFaction: Faction = b.faction === 'royal' ? 'infernal' : 'royal';
      const bCenterX = b.gridX + def.width / 2;
      const bCenterZ = b.gridZ + def.height / 2;

      let bestUnit: UnitState | null = null;
      let minDistSq = def.range * def.range;

      for (const u of state.units) {
        if (u.faction !== enemyFaction || u.state === 'ko') continue;
        const dx = u.x - bCenterX;
        const dz = u.z - bCenterZ;
        const distSq = dx * dx + dz * dz;
        if (distSq <= minDistSq) {
          minDistSq = distSq;
          bestUnit = u;
        }
      }

      if (bestUnit) {
        b.attackCooldown = def.attackSpeed;
        const dmg = def.damage[b.level - 1];
        const kind = b.type === 'cannon_tower' ? 'cannon' : b.type === 'arc_spire' ? 'beam' : 'fireball';

        state.projectiles.push({
          id: `p_${Date.now()}_${Math.random()}`,
          sourceX: bCenterX,
          sourceZ: bCenterZ,
          sourceY: 1.2,
          targetX: bestUnit.x,
          targetZ: bestUnit.z,
          targetY: 0.5,
          targetId: bestUnit.id,
          targetKind: 'unit',
          damage: dmg,
          faction: b.faction,
          kind,
          progress: 0,
          speed: kind === 'beam' ? 4.0 : 2.2,
        });
      }
    }
  }

  // 3. RTS Unit Behaviors: Vicinity Detection, Attacking, Point-to-Point Walking & Waiting (Idle)
  const crossings = state.mapId === 'twin_bridges' ? [3.5, 10.0, 16.5] : [3.0, 10.0, 17.0];

  for (const u of state.units) {
    if (u.state === 'ko') {
      u.koTimer += dt;
      continue;
    }

    u.attackCooldown = Math.max(0, u.attackCooldown - dt);
    const enemyFaction: Faction = u.faction === 'royal' ? 'infernal' : 'royal';
    const def = UNIT_DEFS[u.type];
    const vicinityRadius = u.aggroRange || def.aggroRange || 6.0;

    let nearestEnemy: { x: number; z: number; id: string; kind: 'building' | 'unit'; hp: number } | null = null;
    let minDist = Infinity;

    // Check enemy units first (unless siege which targets buildings)
    if (def.targetPriority !== 'buildings_only') {
      for (const other of state.units) {
        if (other.faction !== enemyFaction || other.state === 'ko') continue;
        const dist = Math.hypot(other.x - u.x, other.z - u.z);
        if (dist < minDist) {
          minDist = dist;
          nearestEnemy = { x: other.x, z: other.z, id: other.id, kind: 'unit', hp: other.hp };
        }
      }
    }

    // Check enemy buildings
    for (const b of state.buildings) {
      if (b.faction !== enemyFaction || b.hp <= 0) continue;
      const bDef = BUILDING_DEFS[b.type];
      const cx = b.gridX + bDef.width / 2;
      const cz = b.gridZ + bDef.height / 2;
      // Measure distance to building edge
      const dist = Math.max(0.2, Math.hypot(cx - u.x, cz - u.z) - (bDef.width * 0.42));
      if (dist < minDist) {
        minDist = dist;
        nearestEnemy = { x: cx, z: cz, id: b.id, kind: 'building', hp: b.hp };
      }
    }

    // Case A: Enemy is within weapon attack range -> Attack!
    if (nearestEnemy && minDist <= u.range) {
      u.state = 'attacking';
      u.targetId = nearestEnemy.id;
      u.targetKind = nearestEnemy.kind;

      if (u.attackCooldown <= 0) {
        u.attackCooldown = u.attackSpeed;

        if (u.type === 'ranged') {
          state.projectiles.push({
            id: `p_u_${Date.now()}_${Math.random()}`,
            sourceX: u.x,
            sourceZ: u.z,
            sourceY: 0.6,
            targetX: nearestEnemy.x,
            targetZ: nearestEnemy.z,
            targetY: nearestEnemy.kind === 'building' ? 0.8 : 0.5,
            targetId: nearestEnemy.id,
            targetKind: nearestEnemy.kind,
            damage: u.damage,
            faction: u.faction,
            kind: u.faction === 'royal' ? 'beam' : 'fireball',
            progress: 0,
            speed: 3.5,
          });
        } else {
          applyDamage(state, nearestEnemy.id, nearestEnemy.kind, u.damage, nearestEnemy.x, nearestEnemy.z);
        }
      }
      continue;
    }

    // Case B: Enemy is in close aggro range -> Charge and engage!
    if (nearestEnemy && minDist <= vicinityRadius) {
      u.state = 'moving';
      u.targetId = nearestEnemy.id;
      u.targetKind = nearestEnemy.kind;
      moveUnitToward(u, nearestEnemy.x, nearestEnemy.z, dt, state.mapId, crossings);
      continue;
    }

    // Case C: Player issued an explicit manual move destination (`targetPos`) -> walk there first
    if (u.targetPos) {
      const distToTarget = Math.hypot(u.targetPos.x - u.x, u.targetPos.z - u.z);
      if (distToTarget > 0.35) {
        u.state = 'moving';
        u.targetId = null;
        u.targetKind = null;
        moveUnitToward(u, u.targetPos.x, u.targetPos.z, dt, state.mapId, crossings);
        continue;
      } else {
        u.targetPos = null;
      }
    }

    // Case D: Automatically target and advance toward the nearest enemy anywhere on the map!
    if (nearestEnemy) {
      u.state = 'moving';
      u.targetId = nearestEnemy.id;
      u.targetKind = nearestEnemy.kind;
      moveUnitToward(u, nearestEnemy.x, nearestEnemy.z, dt, state.mapId, crossings);
    } else {
      u.targetId = null;
      u.targetKind = null;
      u.state = 'idle';
    }
  }

  // 3b. Gentle unit-to-unit separation so squads don't overlap on the exact same spot
  for (let i = 0; i < state.units.length; i++) {
    const a = state.units[i];
    if (a.state === 'ko') continue;
    for (let j = i + 1; j < state.units.length; j++) {
      const b = state.units[j];
      if (b.state === 'ko') continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dz);
      const minSep = 0.52;
      if (dist > 0.001 && dist < minSep) {
        const push = ((minSep - dist) * 0.35);
        const nx = dx / dist;
        const nz = dz / dist;
        if (!isPointInHazard(a.x - nx * push, a.z - nz * push, state.mapId)) {
          a.x = Math.max(0.5, Math.min(GRID_COLS - 0.5, a.x - nx * push));
          a.z = Math.max(0.5, Math.min(GRID_ROWS - 0.5, a.z - nz * push));
        }
        if (!isPointInHazard(b.x + nx * push, b.z + nz * push, state.mapId)) {
          b.x = Math.max(0.5, Math.min(GRID_COLS - 0.5, b.x + nx * push));
          b.z = Math.max(0.5, Math.min(GRID_ROWS - 0.5, b.z + nz * push));
        }
      }
    }
  }

  // 4. Update Projectiles
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.progress += dt * p.speed;

    if (p.progress >= 1.0) {
      applyDamage(state, p.targetId, p.targetKind, p.damage, p.targetX, p.targetZ);
      state.projectiles.splice(i, 1);
    }
  }

  // 5. Clean up KO units after delay
  state.units = state.units.filter((u) => u.state !== 'ko' || u.koTimer < 0.6);

  // 6. Update Floating Texts
  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    const ft = state.floatingTexts[i];
    ft.lifetime += dt;
    if (ft.lifetime >= ft.maxLifetime) {
      state.floatingTexts.splice(i, 1);
    }
  }

  // 7. Check Castle Keeps for Win Condition
  const royalCapital = state.buildings.find((b) => b.id === 'cap_royal');
  const infernalCapital = state.buildings.find((b) => b.id === 'cap_infernal');

  if (!royalCapital || royalCapital.hp <= 0) {
    state.status = 'gameover';
    state.winner = 'infernal';
  } else if (!infernalCapital || infernalCapital.hp <= 0) {
    state.status = 'gameover';
    state.winner = 'royal';
  }
}

/**
 * Moves a unit smoothly toward (destX, destZ), routing across the nearest forest ford/bridge
 * if the unit needs to cross the central stream (X: 14.2..17.8).
 */
function moveUnitToward(
  u: UnitState,
  destX: number,
  destZ: number,
  dt: number,
  mapId: MapId,
  crossings: number[]
): void {
  let steerX = destX;
  let steerZ = destZ;

  // Check if unit and destination are on opposite sides of the central stream (X: 14.2..17.8)
  const crossesStream =
    (u.x < 14.2 && destX > 14.2) ||
    (u.x > 17.8 && destX < 17.8) ||
    (u.x >= 14.0 && u.x <= 18.0);

  if (crossesStream) {
    // Pick nearest crossing Z
    let bestBridgeZ = crossings[0];
    let bestScore = Infinity;
    for (const cz of crossings) {
      const score = Math.abs(u.z - cz) + Math.abs(destZ - cz) * 0.5;
      if (score < bestScore) {
        bestScore = score;
        bestBridgeZ = cz;
      }
    }

    // If not yet aligned with the crossing corridor, steer to the bridge entrance first
    if (Math.abs(u.z - bestBridgeZ) > 1.85 && (u.x < 14.3 || u.x > 17.7)) {
      steerX = u.x < 16.0 ? 13.6 : 18.4;
      steerZ = bestBridgeZ;
    } else if (u.x >= 13.8 && u.x <= 18.2 && Math.abs(destZ - bestBridgeZ) > 1.85 && ((u.x < 16 && destX > 18) || (u.x > 16 && destX < 14))) {
      // Currently crossing the bridge/ford
      steerX = destX > u.x ? 18.5 : 13.5;
      steerZ = bestBridgeZ;
    }
  }

  const dx = steerX - u.x;
  const dz = steerZ - u.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 0.03) {
    const step = Math.min(dist, u.speed * dt);
    const nextX = u.x + (dx / dist) * step;
    const nextZ = u.z + (dz / dist) * step;
    if (!isPointInHazard(nextX, nextZ, mapId)) {
      u.x = nextX;
      u.z = nextZ;
    } else {
      // Slide along Z toward nearest ford
      let nearestCz = crossings[0];
      for (const cz of crossings) {
        if (Math.abs(u.z - cz) < Math.abs(u.z - nearestCz)) nearestCz = cz;
      }
      const zSign = Math.sign(nearestCz - u.z) || 1;
      u.z += zSign * u.speed * dt;
    }
  }
}

function applyDamage(
  state: BattleState,
  targetId: string,
  targetKind: 'building' | 'unit',
  dmg: number,
  hitX: number,
  hitZ: number
): void {
  let targetFaction: Faction = 'royal';

  if (targetKind === 'building') {
    const b = state.buildings.find((item) => item.id === targetId);
    if (b) {
      b.hp = Math.max(0, b.hp - dmg);
      targetFaction = b.faction;
      if (b.hp <= 0 && b.type !== 'capital') {
        state.buildings = state.buildings.filter((item) => item.id !== targetId);
      }
    }
  } else {
    const u = state.units.find((item) => item.id === targetId);
    if (u && u.state !== 'ko') {
      u.hp = Math.max(0, u.hp - dmg);
      targetFaction = u.faction;
      if (u.hp <= 0) {
        u.state = 'ko';
        u.koTimer = 0;
      }
    }
  }

  state.floatingTexts.push({
    id: `dmg_${Date.now()}_${Math.random()}`,
    x: hitX + (Math.random() - 0.5) * 0.4,
    z: hitZ + (Math.random() - 0.5) * 0.4,
    text: `-${dmg}`,
    color: targetFaction === 'royal' ? '#60A5FA' : '#F87171',
    lifetime: 0,
    maxLifetime: 0.9,
  });
}

/**
 * RTS AI Commander logic for solo mode (plays Infernal faction):
 * Builds Gold Mills, Barracks, and Towers, and periodically selects its waiting Barracks troops
 * to march in coordinated squads toward forest shrines or the Royal Castle!
 */
let botActionTimer = 0;
export function stepBotAI(state: BattleState, dt: number): void {
  if (state.mode !== 'ai' || state.status !== 'playing') return;

  botActionTimer += dt;
  if (botActionTimer < 1.6) return;
  botActionTimer = 0;

  const bot = state.players.infernal;
  const botBuildings = state.buildings.filter((b) => b.faction === 'infernal');
  const refineries = botBuildings.filter((b) => b.type === 'refinery');
  const barracks = botBuildings.filter((b) => b.type === 'barracks');
  const defenseTowers = botBuildings.filter((b) => b.type === 'cannon_tower' || b.type === 'arc_spire');

  // 1. RTS Squad Command: If AI has >= 4 idle units waiting at its Barracks, order them to march!
  const idleUnits = state.units.filter(
    (u) => u.faction === 'infernal' && u.state === 'idle' && !u.targetPos
  );
  if (idleUnits.length >= 4) {
    // Pick a strategic target: an unowned shrine or the Royal Castle Keep
    let targetX = ROYAL_CAPITAL_X + 1.5;
    let targetZ = ROYAL_CAPITAL_Z + 1.0;

    if (state.neutralObjectives && state.neutralObjectives.length > 0 && Math.random() < 0.6) {
      const unowned = state.neutralObjectives.filter((o) => o.owner !== 'infernal');
      if (unowned.length > 0) {
        const chosen = unowned[Math.floor(Math.random() * unowned.length)];
        targetX = chosen.x;
        targetZ = chosen.z;
      }
    }

    commandUnitsMove(
      state,
      'infernal',
      idleUnits.map((u) => u.id),
      targetX,
      targetZ
    );
  }

  // 2. Build Gold Mills in rear forest spots
  if (refineries.length < 2 && bot.gold >= 75) {
    const refinerySpots = [
      { x: 29, z: 6 },
      { x: 29, z: 13 },
      { x: 30, z: 8 },
      { x: 30, z: 12 },
    ];
    for (const spot of refinerySpots) {
      if (canPlaceBuilding(state, 'infernal', 'refinery', spot.x, spot.z).ok) {
        placeBuilding(state, 'infernal', 'refinery', spot.x, spot.z);
        return;
      }
    }
  }

  // 3. Build a second Barracks to train ranged or siege troops
  if (barracks.length < 2 && bot.gold >= 90) {
    const barracksSpots = [
      { x: 25, z: 6 },
      { x: 25, z: 13 },
      { x: 26, z: 5 },
      { x: 26, z: 14 },
    ];
    for (const spot of barracksSpots) {
      if (canPlaceBuilding(state, 'infernal', 'barracks', spot.x, spot.z).ok) {
        const res = placeBuilding(state, 'infernal', 'barracks', spot.x, spot.z);
        if (res.building) {
          res.building.producingUnitType = 'ranged';
        }
        return;
      }
    }
  }

  // 4. Build forward Watchtowers
  if (defenseTowers.length < 3 && bot.gold >= 100) {
    const defenseType: BuildingType = Math.random() > 0.5 ? 'cannon_tower' : 'arc_spire';
    const forwardSpots = [
      { x: 21, z: 7 },
      { x: 21, z: 12 },
      { x: 22, z: 4 },
      { x: 22, z: 15 },
    ];
    for (const spot of forwardSpots) {
      if (canPlaceBuilding(state, 'infernal', defenseType, spot.x, spot.z).ok) {
        placeBuilding(state, 'infernal', defenseType, spot.x, spot.z);
        return;
      }
    }
  }

  // 5. Upgrade Barracks or Refineries
  if (bot.gold >= 140) {
    const upgBarracks = barracks.find((b) => b.level < 3);
    if (upgBarracks && canUpgradeBuilding(state, 'infernal', upgBarracks.id).ok) {
      upgradeBuilding(state, 'infernal', upgBarracks.id);
      return;
    }
    const upgRef = refineries.find((r) => r.level < 3);
    if (upgRef && canUpgradeBuilding(state, 'infernal', upgRef.id).ok) {
      upgradeBuilding(state, 'infernal', upgRef.id);
      return;
    }
  }

  // 6. Train extra troops when rich
  if (bot.gold >= 160 && Math.random() > 0.5) {
    deployUnit(state, 'infernal', 'siege', 'center');
  } else if (bot.gold >= 100 && Math.random() > 0.4) {
    deployUnit(state, 'infernal', 'ranged', 'center');
  } else if (bot.gold >= 80 && Math.random() > 0.5) {
    deployUnit(state, 'infernal', 'melee', 'center');
  }
}
