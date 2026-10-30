/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { Faction, UnitType } from '../types';

// Shared stylized low-poly PBR materials with crisp geometric flatShading
const MATS = {
  // Architectural Stone & Masonry
  stoneLight: new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.72,
    metalness: 0.05,
    flatShading: true,
  }),
  stoneWarm: new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.8,
    metalness: 0.05,
    flatShading: true,
  }),
  stoneDark: new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.85,
    metalness: 0.08,
    flatShading: true,
  }),

  // Metals & Timber
  steel: new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.32,
    metalness: 0.35,
    flatShading: true,
  }),
  darkIron: new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.45,
    metalness: 0.35,
    flatShading: true,
  }),
  gold: new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    roughness: 0.28,
    metalness: 0.35,
    flatShading: true,
  }),
  goldBright: new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.22,
    roughness: 0.25,
    metalness: 0.35,
    flatShading: true,
  }),
  timber: new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.82,
    metalness: 0.02,
    flatShading: true,
  }),
  timberLight: new THREE.MeshStandardMaterial({
    color: 0x92400e,
    roughness: 0.75,
    metalness: 0.02,
    flatShading: true,
  }),
  hay: new THREE.MeshStandardMaterial({
    color: 0xfde047,
    roughness: 0.88,
    metalness: 0.0,
    flatShading: true,
  }),
  skin: new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    roughness: 0.65,
    metalness: 0.0,
    flatShading: true,
  }),

  // BLUE TEAM (Royal Faction)
  bluePrimary: new THREE.MeshStandardMaterial({
    color: 0x2563eb,
    roughness: 0.42,
    metalness: 0.12,
    flatShading: true,
  }),
  blueDark: new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    roughness: 0.5,
    metalness: 0.12,
    flatShading: true,
  }),
  blueLight: new THREE.MeshStandardMaterial({
    color: 0x60a5fa,
    roughness: 0.35,
    metalness: 0.1,
    flatShading: true,
  }),
  blueGlow: new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    emissive: 0x2563eb,
    emissiveIntensity: 0.75,
    roughness: 0.2,
    metalness: 0.15,
    flatShading: true,
  }),
  blueRing: new THREE.MeshBasicMaterial({
    color: 0x2563eb,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),

  // RED TEAM (Infernal Faction)
  redPrimary: new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.42,
    metalness: 0.12,
    flatShading: true,
  }),
  redDark: new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    roughness: 0.5,
    metalness: 0.12,
    flatShading: true,
  }),
  redLight: new THREE.MeshStandardMaterial({
    color: 0xf87171,
    roughness: 0.35,
    metalness: 0.1,
    flatShading: true,
  }),
  redGlow: new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.75,
    roughness: 0.2,
    metalness: 0.15,
    flatShading: true,
  }),
  redRing: new THREE.MeshBasicMaterial({
    color: 0xdc2626,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),

  // RTS Selection Ring (Bright Emerald / Cyan highlight)
  selectedUnitRing: new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
  selectedUnitFill: new THREE.MeshBasicMaterial({
    color: 0x4ade80,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),

  // Contact shadow
  shadow: new THREE.MeshBasicMaterial({
    color: 0x0f172a,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  }),
};

function getTeamMats(faction: Faction) {
  if (faction === 'royal') {
    return {
      primary: MATS.bluePrimary,
      dark: MATS.blueDark,
      light: MATS.blueLight,
      glow: MATS.blueGlow,
      ring: MATS.blueRing,
    };
  }
  return {
    primary: MATS.redPrimary,
    dark: MATS.redDark,
    light: MATS.redLight,
    glow: MATS.redGlow,
    ring: MATS.redRing,
  };
}

function addContactShadow(group: THREE.Group, radius: number, faction?: Faction) {
  const geo = new THREE.CircleGeometry(radius, 16);
  geo.rotateX(-Math.PI / 2);
  const shadow = new THREE.Mesh(geo, MATS.shadow);
  shadow.position.y = 0.015;
  group.add(shadow);

  if (faction) {
    const team = getTeamMats(faction);
    const ringGeo = new THREE.RingGeometry(radius * 0.78, radius * 0.96, 16);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, team.ring);
    ring.position.y = 0.022;
    group.add(ring);
  }
}

/**
 * Grand Low-Poly Castle Keep: 2x2 multi-tiered medieval castle with curtain walls,
 * 4 corner bastion towers, crenellations, arched portcullis gatehouse & royal spire.
 */
export function createCapitalMesh(faction: Faction): THREE.Group {
  const group = new THREE.Group();
  const team = getTeamMats(faction);
  addContactShadow(group, 1.48, faction);

  // 1. Stepped Low-Poly Stone Castle Mound & Courtyard Plinth
  const plinthOuter = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.26, 2.05), MATS.stoneDark);
  plinthOuter.position.y = 0.13;
  plinthOuter.castShadow = true;
  plinthOuter.receiveShadow = true;
  group.add(plinthOuter);

  const plinthInner = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.22, 1.86), MATS.stoneWarm);
  plinthInner.position.y = 0.36;
  plinthInner.castShadow = true;
  plinthInner.receiveShadow = true;
  group.add(plinthInner);

  // 2. Outer Castle Curtain Walls connecting the 4 Corner Bastions
  const wallN = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.72, 0.18), MATS.stoneWarm);
  wallN.position.set(0, 0.72, -0.78);
  wallN.castShadow = true;
  const wallS = wallN.clone();
  wallS.position.set(0, 0.72, 0.78);

  const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 1.56), MATS.stoneWarm);
  wallW.position.set(-0.78, 0.72, 0);
  wallW.castShadow = true;
  const wallE = wallW.clone();
  wallE.position.set(0.78, 0.72, 0);
  group.add(wallN, wallS, wallW, wallE);

  // Team Livery Trim along Curtain Walls
  const trimBand = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.1, 1.88), team.primary);
  trimBand.position.y = 0.46;
  group.add(trimBand);

  // 3. Towering Central Castle Keep
  const keep = new THREE.Mesh(new THREE.BoxGeometry(1.18, 1.38, 1.18), MATS.stoneLight);
  keep.position.y = 1.14;
  keep.castShadow = true;
  keep.receiveShadow = true;
  group.add(keep);

  // Keep Upper Battlement Collar & Merlons
  const keepCollar = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.18, 1.32), MATS.stoneWarm);
  keepCollar.position.y = 1.86;
  keepCollar.castShadow = true;
  group.add(keepCollar);

  // 4. Grand Low-Poly Pitched Castle Roof & Belfry Spire
  const mainRoofGeo = new THREE.ConeGeometry(0.92, 1.05, 4);
  mainRoofGeo.rotateY(Math.PI / 4);
  const mainRoof = new THREE.Mesh(mainRoofGeo, team.primary);
  mainRoof.position.y = 2.45;
  mainRoof.castShadow = true;
  group.add(mainRoof);

  // Gold Spire Finial & Floating Arcane Crest
  const spireRod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.36, 6), MATS.gold);
  spireRod.position.y = 3.05;
  group.add(spireRod);

  const spireOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), team.glow);
  spireOrb.position.y = 3.28;
  spireOrb.name = 'floatingCrystal';
  group.add(spireOrb);

  // 5. Four Low-Poly Corner Bastion Towers with Conical Roofs
  const corners = [
    [-0.78, -0.78],
    [0.78, -0.78],
    [-0.78, 0.78],
    [0.78, 0.78],
  ];
  corners.forEach(([cx, cz]) => {
    const towerShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.3, 1.48, 7),
      MATS.stoneLight
    );
    towerShaft.position.set(cx, 0.92, cz);
    towerShaft.castShadow = true;
    towerShaft.receiveShadow = true;
    group.add(towerShaft);

    const towerRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.31, 0.31, 0.15, 7),
      MATS.stoneDark
    );
    towerRing.position.set(cx, 1.68, cz);
    group.add(towerRing);

    const towerRoof = new THREE.Mesh(
      new THREE.ConeGeometry(0.36, 0.62, 7),
      team.dark
    );
    towerRoof.position.set(cx, 2.04, cz);
    towerRoof.castShadow = true;
    group.add(towerRoof);

    const towerTip = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), MATS.gold);
    towerTip.position.set(cx, 2.38, cz);
    group.add(towerTip);
  });

  // 6. Grand Castle Gatehouse & Iron Portcullis (Facing Opponent)
  const gateDir = faction === 'royal' ? 1 : -1;
  const gateFrame = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.78, 0.64), MATS.stoneDark);
  gateFrame.position.set(gateDir * 0.78, 0.78, 0);
  gateFrame.castShadow = true;
  group.add(gateFrame);

  const gateDoor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.6, 0.44), MATS.timber);
  gateDoor.position.set(gateDir * 0.8, 0.7, 0);
  group.add(gateDoor);

  // Hanging Heraldic Banners on Keep Facades
  [-0.36, 0.36].forEach((bz) => {
    const banner = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.22), team.primary);
    banner.position.set(gateDir * 0.62, 1.38, bz);
    group.add(banner);

    const bannerTrim = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.24), MATS.gold);
    bannerTrim.position.set(gateDir * 0.62, 1.68, bz);
    group.add(bannerTrim);
  });

  return group;
}

/**
 * Garrison Barracks: 1x1 Low-Poly Medieval Troop Barracks with pitched roof,
 * troop doorway, weapon rack, training dummy, forge brazier & rally banner!
 */
export function createBarracksMesh(faction: Faction, level: 1 | 2 | 3): THREE.Group {
  const group = new THREE.Group();
  const team = getTeamMats(faction);
  addContactShadow(group, 0.68, faction);
  const scaleY = 1 + (level - 1) * 0.16;
  const dir = faction === 'royal' ? 1 : -1;

  // 1. Stone Courtyard Plinth
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.2, 0.94), MATS.stoneDark);
  base.position.y = 0.1;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // 2. Main Garrison Hall (Timber & Stone)
  const hallH = 0.56 * scaleY;
  const hall = new THREE.Mesh(new THREE.BoxGeometry(0.68, hallH, 0.74), MATS.stoneLight);
  hall.position.set(-dir * 0.06, 0.2 + hallH / 2, 0);
  hall.castShadow = true;
  hall.receiveShadow = true;
  group.add(hall);

  // Timber Cross-Beams
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.71, 0.08, 0.77), MATS.timber);
  beam.position.set(-dir * 0.06, 0.2 + hallH * 0.55, 0);
  group.add(beam);

  // 3. Low-Poly Pitched Garrison Roof in Team Color
  const roofGeo = new THREE.ConeGeometry(0.58, 0.48, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roof = new THREE.Mesh(roofGeo, team.primary);
  roof.position.set(-dir * 0.06, 0.2 + hallH + 0.22, 0);
  roof.castShadow = true;
  group.add(roof);

  // Gold Roof Crest & Crossed Swords Finial
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.52), MATS.gold);
  crest.position.set(-dir * 0.06, 0.2 + hallH + 0.42, 0);
  group.add(crest);

  // 4. Garrison Troop Archway Door (Facing Rally Yard)
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.36), MATS.stoneDark);
  doorFrame.position.set(dir * 0.26, 0.41, 0);
  group.add(doorFrame);

  const doorOpening = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.26), MATS.darkIron);
  doorOpening.position.set(dir * 0.27, 0.37, 0);
  group.add(doorOpening);

  // 5. Outdoor Training Dummy & Weapon Shield Rack in Courtyard
  const dummyPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.36, 6), MATS.timber);
  dummyPole.position.set(dir * 0.34, 0.36, 0.28);
  const dummyBody = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.2, 6), MATS.hay);
  dummyBody.position.set(dir * 0.34, 0.42, 0.28);
  const dummyShield = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.14), team.primary);
  dummyShield.position.set(dir * 0.39, 0.42, 0.28);
  group.add(dummyPole, dummyBody, dummyShield);

  // 6. Tall Heraldic Rally Banner Pole
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.15 * scaleY, 6), MATS.gold);
  flagPole.position.set(dir * 0.34, 0.2 + 0.55 * scaleY, -0.3);
  const flagCloth = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.04), team.glow);
  flagCloth.position.set(dir * 0.46, 0.2 + 0.98 * scaleY, -0.3);
  flagCloth.name = 'floatingCrystal';
  group.add(flagPole, flagCloth);

  return group;
}

/**
 * Gold Refinery: 1x1 Guild Gold Mill with waterwheel, team roof & bullion cart
 */
export function createRefineryMesh(faction: Faction, level: 1 | 2 | 3): THREE.Group {
  const group = new THREE.Group();
  const team = getTeamMats(faction);
  addContactShadow(group, 0.62, faction);
  const scaleY = 1 + (level - 1) * 0.2;

  // 1. Cobblestone Plinth
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.9), MATS.stoneDark);
  base.position.y = 0.11;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // 2. Half-Timbered Mill House
  const houseH = 0.52 * scaleY;
  const house = new THREE.Mesh(new THREE.BoxGeometry(0.64, houseH, 0.62), MATS.stoneLight);
  house.position.y = 0.22 + houseH / 2;
  house.castShadow = true;
  house.receiveShadow = true;
  group.add(house);

  // Timber Framing Band
  const frameBand = new THREE.Mesh(new THREE.BoxGeometry(0.67, 0.08, 0.65), MATS.timber);
  frameBand.position.y = 0.22 + houseH * 0.5;
  group.add(frameBand);

  // 3. Pitched Team-Colored Roof
  const roofGeo = new THREE.ConeGeometry(0.54, 0.46, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roof = new THREE.Mesh(roofGeo, team.primary);
  roof.position.y = 0.22 + houseH + 0.22;
  roof.castShadow = true;
  group.add(roof);

  // Gold Roof Ridge Finial
  const ridge = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), MATS.gold);
  ridge.position.y = 0.22 + houseH + 0.46;
  group.add(ridge);

  // 4. Rotating Waterwheel on the Side
  const wheelGroup = new THREE.Group();
  wheelGroup.name = 'waterwheel';
  wheelGroup.position.set(0, 0.42, 0.36);

  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 10), MATS.timberLight);
  rim.rotation.x = Math.PI / 2;
  wheelGroup.add(rim);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.11, 8), MATS.gold);
  hub.rotation.x = Math.PI / 2;
  wheelGroup.add(hub);
  group.add(wheelGroup);

  // 5. Bullion Hopper & Gold Ingot Stack
  const cart = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.36), MATS.timber);
  cart.position.set(0.32, 0.28, -0.1);
  group.add(cart);

  for (let i = 0; i < level; i++) {
    const ingot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.12), MATS.goldBright);
    ingot.position.set(0.32, 0.38 + i * 0.07, -0.1 + (i - 1) * 0.06);
    group.add(ingot);
  }

  return group;
}

/**
 * Cannon Tower: 1x1 Bastion Artillery with team shields & heavy brass/iron cannon
 */
export function createCannonTowerMesh(faction: Faction, level: 1 | 2 | 3): THREE.Group {
  const group = new THREE.Group();
  const team = getTeamMats(faction);
  addContactShadow(group, 0.64, faction);
  const scaleY = 1 + (level - 1) * 0.18;

  // 1. Octagonal Stone Foundation
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.24, 7), MATS.stoneDark);
  base.position.y = 0.12;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // 2. Main Bastion Tower Shaft
  const shaftH = 0.68 * scaleY;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, shaftH, 7), MATS.stoneLight);
  shaft.position.y = 0.24 + shaftH / 2;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  group.add(shaft);

  // Team Color Collar Band
  const teamBand = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.12, 7), team.primary);
  teamBand.position.y = 0.24 + shaftH * 0.65;
  group.add(teamBand);

  // 3. Crenellated Battlement Platform
  const topY = 0.24 + shaftH;
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.4, 0.16, 7), MATS.stoneWarm);
  plat.position.y = topY + 0.08;
  plat.castShadow = true;
  group.add(plat);

  // 4. Mounted Artillery Carriage & Cannon Barrel
  const aimDir = faction === 'royal' ? 1 : -1;
  const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.28), team.dark);
  carriage.position.set(0, topY + 0.24, 0);
  group.add(carriage);

  const barrelGeo = new THREE.CylinderGeometry(0.1, 0.14, 0.62, 8);
  barrelGeo.rotateZ(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, level >= 2 ? MATS.gold : MATS.darkIron);
  barrel.position.set(aimDir * 0.22, topY + 0.3, 0);
  barrel.castShadow = true;
  group.add(barrel);

  // Muzzle Ring
  const muzzleGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 8);
  muzzleGeo.rotateZ(Math.PI / 2);
  const muzzle = new THREE.Mesh(muzzleGeo, MATS.gold);
  muzzle.position.set(aimDir * 0.5, topY + 0.3, 0);
  group.add(muzzle);

  return group;
}

/**
 * Arc Spire: 1x1 Arcane Crystal Tower with buttresses & orbiting crystal
 */
export function createArcSpireMesh(faction: Faction, level: 1 | 2 | 3): THREE.Group {
  const group = new THREE.Group();
  const team = getTeamMats(faction);
  addContactShadow(group, 0.62, faction);
  const scaleY = 1 + (level - 1) * 0.2;

  // 1. Stepped Hexagonal Pedestal
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.48, 0.22, 6), MATS.stoneDark);
  base.position.y = 0.11;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // 2. Slender Ivory Marble Spire
  const shaftH = 0.95 * scaleY;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, shaftH, 6), MATS.stoneLight);
  shaft.position.y = 0.22 + shaftH / 2;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  group.add(shaft);

  // Team Livery Bands
  const lowerBand = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.14, 6), team.primary);
  lowerBand.position.y = 0.22 + shaftH * 0.3;
  group.add(lowerBand);

  const upperBand = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.12, 6), team.primary);
  upperBand.position.y = 0.22 + shaftH * 0.72;
  group.add(upperBand);

  // 3. Golden Crown Emitter Prongs
  const topY = 0.22 + shaftH;
  const crownGeo = new THREE.ConeGeometry(0.32, 0.3, 6);
  crownGeo.rotateX(Math.PI);
  const crown = new THREE.Mesh(crownGeo, MATS.gold);
  crown.position.y = topY + 0.12;
  group.add(crown);

  // 4. Floating Team-Colored Arcane Crystal
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), team.glow);
  crystal.position.y = topY + 0.42;
  crystal.name = 'floatingCrystal';
  group.add(crystal);

  return group;
}

/**
 * Unit Meshes: Stylized Low-Poly Melee Knight, Ranged Marksman, and Siege Ram
 * with built-in RTS selection ring (`name = 'selectionRing'`).
 */
export function createUnitMesh(faction: Faction, type: UnitType, level: 1 | 2 | 3): THREE.Group {
  const group = new THREE.Group();
  const team = getTeamMats(faction);
  const scale = 1 + (level - 1) * 0.16;

  const selRadius = type === 'siege' ? 0.72 * scale : 0.46 * scale;
  const selGroup = new THREE.Group();
  selGroup.name = 'selectionRing';
  selGroup.visible = false;

  const selOuterGeo = new THREE.RingGeometry(selRadius * 0.82, selRadius, 24);
  selOuterGeo.rotateX(-Math.PI / 2);
  const selOuter = new THREE.Mesh(selOuterGeo, MATS.selectedUnitRing);
  selOuter.position.y = 0.032;

  const selInnerGeo = new THREE.CircleGeometry(selRadius * 0.82, 24);
  selInnerGeo.rotateX(-Math.PI / 2);
  const selInner = new THREE.Mesh(selInnerGeo, MATS.selectedUnitFill);
  selInner.position.y = 0.028;

  selGroup.add(selOuter, selInner);
  group.add(selGroup);

  if (type === 'melee') {
    addContactShadow(group, 0.38 * scale, faction);

    // 1. Boots / Legs
    const legGeo = new THREE.CylinderGeometry(0.055 * scale, 0.055 * scale, 0.24 * scale, 6);
    const lLeg = new THREE.Mesh(legGeo, MATS.darkIron);
    lLeg.position.set(-0.075 * scale, 0.12 * scale, 0);
    const rLeg = lLeg.clone();
    rLeg.position.x = 0.075 * scale;
    group.add(lLeg, rLeg);

    // 2. Armored Torso with Team Tabard
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.25 * scale, 0.3 * scale, 0.19 * scale),
      team.primary
    );
    torso.position.y = 0.37 * scale;
    torso.castShadow = true;
    group.add(torso);

    // Gold Chest Crest
    const chestPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.14 * scale, 0.18 * scale, 0.21 * scale),
      level >= 2 ? MATS.gold : MATS.steel
    );
    chestPlate.position.y = 0.39 * scale;
    group.add(chestPlate);

    // Flowing Team Cape on Back
    const cape = new THREE.Mesh(
      new THREE.BoxGeometry(0.24 * scale, 0.32 * scale, 0.04 * scale),
      team.dark
    );
    cape.position.set(0, 0.34 * scale, -0.11 * scale);
    cape.rotation.x = 0.18;
    group.add(cape);

    // 3. Low-Poly Knight Helmet & Team Plume
    const helm = new THREE.Mesh(new THREE.DodecahedronGeometry(0.125 * scale, 0), MATS.steel);
    helm.position.y = 0.6 * scale;
    helm.castShadow = true;
    group.add(helm);

    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.16 * scale, 0.07 * scale, 0.12 * scale),
      MATS.gold
    );
    visor.position.set(0, 0.59 * scale, 0.08 * scale);
    group.add(visor);

    const plume = new THREE.Mesh(
      new THREE.BoxGeometry(0.06 * scale, 0.14 * scale, 0.18 * scale),
      team.light
    );
    plume.position.set(0, 0.74 * scale, -0.02 * scale);
    group.add(plume);

    // 4. Heater Shield in Team Color with Gold Rim
    const shieldRim = new THREE.Mesh(
      new THREE.BoxGeometry(0.05 * scale, 0.3 * scale, 0.25 * scale),
      MATS.gold
    );
    shieldRim.position.set(-0.18 * scale, 0.38 * scale, 0.07 * scale);
    group.add(shieldRim);

    const shieldFace = new THREE.Mesh(
      new THREE.BoxGeometry(0.06 * scale, 0.24 * scale, 0.19 * scale),
      team.primary
    );
    shieldFace.position.set(-0.185 * scale, 0.38 * scale, 0.07 * scale);
    group.add(shieldFace);

    // 5. Broadsword
    const hilt = new THREE.Mesh(
      new THREE.BoxGeometry(0.05 * scale, 0.05 * scale, 0.14 * scale),
      MATS.gold
    );
    hilt.position.set(0.18 * scale, 0.38 * scale, 0.12 * scale);
    group.add(hilt);

    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.035 * scale, 0.38 * scale, 0.07 * scale),
      MATS.steel
    );
    blade.position.set(0.18 * scale, 0.54 * scale, 0.16 * scale);
    blade.rotation.x = 0.35;
    group.add(blade);
  } else if (type === 'ranged') {
    addContactShadow(group, 0.35 * scale, faction);

    // 1. Cloaked Marksman Tunic in Team Color
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12 * scale, 0.19 * scale, 0.46 * scale, 7),
      team.primary
    );
    body.position.y = 0.26 * scale;
    body.castShadow = true;
    group.add(body);

    // Gold Shoulder Mantle
    const mantle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16 * scale, 0.18 * scale, 0.1 * scale, 7),
      MATS.gold
    );
    mantle.position.y = 0.45 * scale;
    group.add(mantle);

    // 2. Head & Team Hood
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.105 * scale, 0), MATS.skin);
    head.position.y = 0.57 * scale;
    group.add(head);

    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.13 * scale, 0.22 * scale, 6), team.dark);
    hood.position.set(0, 0.68 * scale, -0.02 * scale);
    hood.rotation.x = -0.2;
    group.add(hood);

    // 3. Crossbow / Forest Bow Launcher
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.06 * scale, 0.06 * scale, 0.32 * scale),
      MATS.timber
    );
    stock.position.set(0.12 * scale, 0.38 * scale, 0.16 * scale);
    group.add(stock);

    const bowProd = new THREE.Mesh(
      new THREE.BoxGeometry(0.36 * scale, 0.04 * scale, 0.06 * scale),
      MATS.gold
    );
    bowProd.position.set(0.12 * scale, 0.39 * scale, 0.28 * scale);
    group.add(bowProd);
  } else {
    // Siege Engine: Armored Battering Ram Wagon in Team Livery
    addContactShadow(group, 0.68 * scale, faction);

    // 1. Heavy Timber Chassis
    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(0.52 * scale, 0.2 * scale, 0.88 * scale),
      MATS.timber
    );
    chassis.position.y = 0.22 * scale;
    chassis.castShadow = true;
    group.add(chassis);

    // 2. Four Iron-Rimmed Wheels
    const wheelCoords = [
      [-0.28, -0.28],
      [0.28, -0.28],
      [-0.28, 0.28],
      [0.28, 0.28],
    ];
    wheelCoords.forEach(([wx, wz]) => {
      const wheelGeo = new THREE.CylinderGeometry(0.15 * scale, 0.15 * scale, 0.08 * scale, 8);
      wheelGeo.rotateZ(Math.PI / 2);
      const wheel = new THREE.Mesh(wheelGeo, MATS.darkIron);
      wheel.position.set(wx * scale, 0.15 * scale, wz * scale);
      group.add(wheel);

      const hubGeo = new THREE.CylinderGeometry(0.06 * scale, 0.06 * scale, 0.1 * scale, 6);
      hubGeo.rotateZ(Math.PI / 2);
      const hub = new THREE.Mesh(hubGeo, MATS.gold);
      hub.position.set(wx * scale, 0.15 * scale, wz * scale);
      group.add(hub);
    });

    // 3. Armored Pitched Canopy Roof in Team Color
    const canopyGeo = new THREE.ConeGeometry(0.44 * scale, 0.34 * scale, 4);
    canopyGeo.rotateY(Math.PI / 4);
    const canopy = new THREE.Mesh(canopyGeo, team.primary);
    canopy.position.set(0, 0.48 * scale, -0.02 * scale);
    canopy.castShadow = true;
    group.add(canopy);

    const canopyCrest = new THREE.Mesh(
      new THREE.BoxGeometry(0.08 * scale, 0.12 * scale, 0.52 * scale),
      MATS.gold
    );
    canopyCrest.position.set(0, 0.62 * scale, -0.02 * scale);
    group.add(canopyCrest);

    // 4. Heavy Battering Ram Log & Golden Ram Head
    const ramLogGeo = new THREE.CylinderGeometry(0.11 * scale, 0.13 * scale, 0.95 * scale, 7);
    ramLogGeo.rotateX(Math.PI / 2);
    const ramLog = new THREE.Mesh(ramLogGeo, MATS.timberLight);
    ramLog.position.set(0, 0.28 * scale, 0.12 * scale);
    group.add(ramLog);

    const ramHeadGeo = new THREE.CylinderGeometry(0.15 * scale, 0.17 * scale, 0.28 * scale, 7);
    ramHeadGeo.rotateX(Math.PI / 2);
    const ramHead = new THREE.Mesh(ramHeadGeo, MATS.gold);
    ramHead.position.set(0, 0.28 * scale, 0.56 * scale);
    ramHead.castShadow = true;
    group.add(ramHead);
  }

  return group;
}
