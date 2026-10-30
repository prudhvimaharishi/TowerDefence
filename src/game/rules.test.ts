/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialGameState,
  canPlaceBuilding,
  placeBuilding,
  canUpgradeBuilding,
  upgradeBuilding,
  demolishBuilding,
  canDeployUnit,
  deployUnit,
  canUpgradeTroopTier,
  upgradeTroopTier,
  stepBattleSimulation,
  getValidSpawnCircles,
  canSpawnUnitAtPosition,
  commandUnitsMove,
} from './rules';

test('createInitialGameState sets up 32x20 forest battlefield with 2 Castles, 2 Barracks, and initial waiting garrison troops', () => {
  const state = createInitialGameState('TEST_ROOM', 'ai');
  assert.equal(state.status, 'playing');
  assert.equal(state.buildings.length, 4);
  const royalCap = state.buildings.find((b) => b.id === 'cap_royal');
  const infernalCap = state.buildings.find((b) => b.id === 'cap_infernal');
  const royalBarracks = state.buildings.find((b) => b.id === 'barracks_royal_init');

  assert.ok(royalCap, 'Royal Castle should exist');
  assert.ok(infernalCap, 'Infernal Castle should exist');
  assert.ok(royalBarracks, 'Royal starting Barracks should exist');
  assert.equal(royalBarracks.type, 'barracks');
  assert.equal(royalCap.hp, 2500);
  assert.equal(infernalCap.hp, 2500);

  // Initial troops wait at their Barracks rally points
  const royalTroops = state.units.filter((u) => u.faction === 'royal');
  assert.equal(royalTroops.length, 3);
  assert.equal(royalTroops[0].state, 'idle');
});

test('Barracks automatically spawns troops and soldiers automatically target nearest enemies', () => {
  const state = createInitialGameState('TEST_ROOM', 'ai');
  const initialRoyalCount = state.units.filter((u) => u.faction === 'royal').length;

  // Step simulation ~3.5 seconds so starting Barracks (productionTimer=5.5, interval=8.5) produces a new troop
  for (let i = 0; i < 70; i++) {
    stepBattleSimulation(state, 0.05);
  }

  const afterRoyalUnits = state.units.filter((u) => u.faction === 'royal');
  assert.ok(afterRoyalUnits.length > initialRoyalCount, 'Barracks should auto-produce a new troop');

  const targetingUnits = afterRoyalUnits.filter((u) => u.targetId !== null);
  assert.equal(targetingUnits.length, afterRoyalUnits.length, 'Spawned soldiers should automatically target the nearest enemy');
});

test('commandUnitsMove orders selected troops to walk to destination and attack enemies in vicinity', () => {
  const state = createInitialGameState('TEST_ROOM', 'ai');
  const royalIds = state.units.filter((u) => u.faction === 'royal').map((u) => u.id);

  const cmd = commandUnitsMove(state, 'royal', royalIds, 16.0, 10.0);
  assert.equal(cmd.success, true);
  assert.equal(cmd.count, 3);

  const firstUnit = state.units.find((u) => u.id === royalIds[0])!;
  assert.equal(firstUnit.state, 'moving');
  assert.ok(firstUnit.targetPos, 'Unit should have a target destination');

  // Place an enemy unit in vicinity of the first Royal unit
  const enemy = state.units.find((u) => u.faction === 'infernal')!;
  enemy.x = firstUnit.x + 2.5;
  enemy.z = firstUnit.z;

  stepBattleSimulation(state, 0.05);
  assert.equal(firstUnit.targetId, enemy.id, 'Unit should automatically target enemy in vicinity');
});

test('canPlaceBuilding enforces 32x20 faction territory and allows building new Barracks', () => {
  const state = createInitialGameState('TEST_ROOM', 'ai');

  const validBarracks = canPlaceBuilding(state, 'royal', 'barracks', 2, 4);
  assert.equal(validBarracks.ok, true);

  const invalidTerritory = canPlaceBuilding(state, 'royal', 'refinery', 24, 4);
  assert.equal(invalidTerritory.ok, false);

  const invalidOverlap = canPlaceBuilding(state, 'royal', 'cannon_tower', 2, 9);
  assert.equal(invalidOverlap.ok, false);
});

test('placeBuilding deducts gold and expands circular unit spawn zones', () => {
  const state = createInitialGameState('TEST_ROOM', 'ai');
  const initialGold = state.players.royal.gold;

  const beforeForward = canSpawnUnitAtPosition(state, 'royal', 11.8, 3.5);
  assert.equal(beforeForward.ok, false);

  const result = placeBuilding(state, 'royal', 'cannon_tower', 10, 3);
  assert.equal(result.success, true);
  assert.ok(result.building);
  assert.equal(state.players.royal.gold, initialGold - 100);

  const circles = getValidSpawnCircles(state, 'royal');
  assert.equal(circles.length, 3);
  const afterForward = canSpawnUnitAtPosition(state, 'royal', 11.8, 3.5);
  assert.equal(afterForward.ok, true);
});

test('upgradeBuilding and demolishBuilding work properly', () => {
  const state = createInitialGameState('TEST_ROOM', 'ai');
  const placed = placeBuilding(state, 'royal', 'refinery', 2, 4);
  assert.ok(placed.building);

  state.players.royal.gold = 500;
  const upgCheck = canUpgradeBuilding(state, 'royal', placed.building.id);
  assert.equal(upgCheck.ok, true);
  assert.equal(upgCheck.nextLevel, 2);

  const upgResult = upgradeBuilding(state, 'royal', placed.building.id);
  assert.equal(upgResult.success, true);
  assert.equal(placed.building.level, 2);
  assert.equal(placed.building.maxHp, 700);

  const goldBeforeDemolish = state.players.royal.gold;
  const demoResult = demolishBuilding(state, 'royal', placed.building.id);
  assert.equal(demoResult.success, true);
  assert.equal(demoResult.refund, 60);
  assert.equal(state.players.royal.gold, goldBeforeDemolish + 60);
});

test('deployUnit spawns troops at Barracks and troop tech upgrade scales unit stats', () => {
  const state = createInitialGameState('TEST_ROOM', 'ai');

  const deploy = deployUnit(state, 'royal', 'melee', 'center');
  assert.equal(deploy.success, true);
  assert.ok(deploy.unit);
  assert.equal(deploy.unit.level, 1);

  const illegalDeploy = canDeployUnit(state, 'royal', 'melee', 'center', 22.0, 10.0);
  assert.equal(illegalDeploy.ok, false);

  state.players.royal.gold = 500;
  const techCheck = canUpgradeTroopTier(state, 'royal', 'melee');
  assert.equal(techCheck.ok, true);
  assert.equal(techCheck.nextTier, 2);

  const techResult = upgradeTroopTier(state, 'royal', 'melee');
  assert.equal(techResult.success, true);
  assert.equal(state.players.royal.troopTiers.melee, 2);

  const deployLv2 = deployUnit(state, 'royal', 'melee', 'center');
  assert.equal(deployLv2.success, true);
  assert.equal(deployLv2.unit?.level, 2);
});
