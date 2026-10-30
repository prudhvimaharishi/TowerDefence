/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BattleState,
  BuildingType,
  BUILDING_DEFS,
  Faction,
  GRID_COLS,
  GRID_ROWS,
  MAP_DEFS,
  MapId,
  NeutralObjectiveState,
  PlacementSelection,
  SpawnCircle,
  UnitType,
} from '../types';
import {
  isTileInFactionTerritory,
  isTileOccupied,
  isTileBlockedByBridge,
  getValidSpawnCircles,
  canSpawnUnitAtPosition,
} from '../rules';
import {
  createCapitalMesh,
  createBarracksMesh,
  createRefineryMesh,
  createCannonTowerMesh,
  createArcSpireMesh,
  createUnitMesh,
} from './models';

export interface CameraTelemetry {
  azimuthDeg: number;
  pitchDeg: number;
  zoomPct: number;
  dragMode: 'select' | 'pan' | 'orbit';
  cameraMode: 'base' | 'center' | 'full';
}

export interface SelectionBoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneCallbacks {
  onTileClick: (gridX: number, gridZ: number, worldX: number, worldZ: number) => void;
  onBuildingClick: (buildingId: string) => void;
  onTileHover: (gridX: number, gridZ: number | null) => void;
  onCameraChange?: (telemetry: CameraTelemetry) => void;
  onSelectionChange?: (unitIds: string[]) => void;
  onMoveUnitsCommand?: (unitIds: string[], worldX: number, worldZ: number) => void;
  onSelectBoxUpdate?: (box: SelectionBoxRect | null) => void;
}

export class ThreeSceneManager {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private isSoftwareGl = false;
  private animFrameId = 0;
  private callbacks: SceneCallbacks;

  // Spherical Orbit Camera Rig (supports 360° rotation, pitch tilt, zoom & camera-relative pan)
  private targetLookAt = new THREE.Vector3(16.0, 0, 10.0);
  private currentLookAt = new THREE.Vector3(16.0, 0, 10.0);
  private targetAzimuth = 0;
  private currentAzimuth = 0;
  private targetPolar = 0.72;
  private currentPolar = 0.72;
  private targetDistance = 28.0;
  private currentDistance = 28.0;
  private dragMode: 'select' | 'pan' | 'orbit' = 'select';
  private currentCameraMode: 'base' | 'center' | 'full' = 'full';
  private lastEmittedAzimuth = -999;
  private lastEmittedPolar = -999;
  private lastEmittedDist = -999;

  // Interaction & RTS Box Selection
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2(-999, -999);
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private hoveredTile: { x: number; z: number } | null = null;
  private hoveredWorldPoint: { x: number; z: number } | null = null;
  private isDragging = false;
  private activePointerAction: 'select' | 'pan' | 'orbit' = 'select';
  private dragStart = { x: 0, y: 0 };
  private lookAtStart = new THREE.Vector3();
  private azimuthStart = 0;
  private polarStart = 0;
  private touchStartDist = 0;
  private touchStartAngle = 0;

  // RTS Selected Units & Move Waypoint Indicator
  private selectedUnitIds = new Set<string>();
  private moveMarkerGroup = new THREE.Group();
  private moveMarkerTimer = 0;
  private rallyFlagsGroup = new THREE.Group();
  private unitTargetLinesGroup = new THREE.Group();

  // Placement preview, tile selection & radial spawn circles
  private placementSelection: PlacementSelection = null;
  private showSpawnRings = false;
  private selectedTile: { x: number; z: number } | null = null;
  private playerFaction: Faction = 'royal';
  private ghostMesh: THREE.Group | null = null;
  private unitCursorRing: THREE.Group;
  private gridHighlightMesh: THREE.Mesh;
  private selectedTileMesh: THREE.Group;
  private spawnCirclesGroup = new THREE.Group();
  private latestState: BattleState | null = null;

  // Map and Environment
  private currentMapId: MapId = 'ironhold_chasm';
  private battlefieldGroup = new THREE.Group();
  private neutralObjectiveMeshes = new Map<string, THREE.Group>();
  private riverTexture: THREE.CanvasTexture | null = null;
  private dirLight: THREE.DirectionalLight;

  // Entities cache
  private buildingMeshes = new Map<string, THREE.Group>();
  private unitMeshes = new Map<string, THREE.Group>();
  private projectileMeshes = new Map<string, THREE.Mesh>();
  private textSprites = new Map<string, THREE.Sprite>();
  private healthBars = new Map<string, { group: THREE.Group; fill: THREE.Mesh; lastPct: number }>();

  // Reusable projection vector (Zero GC in selection/render loop)
  private _projVec = new THREE.Vector3();

  constructor(container: HTMLElement, callbacks: SceneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // 1. Detect software WebGL
    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    // 2. Setup Scene & Warm Forest Horizon Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xcffafe);
    this.scene.fog = new THREE.Fog(0xcffafe, 42, 95);

    // 3. Setup Camera
    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    const initialFov = aspect < 0.9 ? THREE.MathUtils.clamp(40 / Math.pow(aspect, 0.52), 40, 60) : 40;
    this.camera = new THREE.PerspectiveCamera(initialFov, aspect, 0.5, 150);

    // 4. Setup Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.5;
    pmremGenerator.dispose();

    container.appendChild(this.renderer.domElement);

    // 5. Golden-Hour Low-Poly Forest Lighting Rig covering the 32x20 Valley
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x4ade80, 0.95);
    hemiLight.position.set(16, 32, 10);
    this.scene.add(hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfffbeb, 1.85);
    this.dirLight.position.set(6, 34, 24);
    this.dirLight.target.position.set(16, 0, 10);
    this.scene.add(this.dirLight.target);

    if (!this.isSoftwareGl) {
      this.dirLight.castShadow = true;
      this.dirLight.shadow.mapSize.width = 2048;
      this.dirLight.shadow.mapSize.height = 2048;
      this.dirLight.shadow.camera.near = 0.5;
      this.dirLight.shadow.camera.far = 80;
      this.dirLight.shadow.camera.left = -24;
      this.dirLight.shadow.camera.right = 24;
      this.dirLight.shadow.camera.top = 18;
      this.dirLight.shadow.camera.bottom = -18;
      this.dirLight.shadow.bias = -0.0005;
      this.dirLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.dirLight);

    // 6. Mount Battlefield, Spawn Circles, Rally Flags, Move Marker & Target Lines
    this.scene.add(this.battlefieldGroup);
    this.scene.add(this.spawnCirclesGroup);
    this.scene.add(this.rallyFlagsGroup);
    this.scene.add(this.unitTargetLinesGroup);
    this.spawnCirclesGroup.visible = false;
    this.buildBattlefield(this.currentMapId);

    // 6b. 3D RTS Move Destination Beacon (appears when user points where troops should walk)
    this.buildMoveMarker();
    this.scene.add(this.moveMarkerGroup);

    // 7. Grid Tile Selector Outline (for buildings)
    const highlightGeo = new THREE.PlaneGeometry(0.96, 0.96);
    highlightGeo.rotateX(-Math.PI / 2);
    const highlightMat = new THREE.MeshBasicMaterial({
      color: 0x2563eb,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.gridHighlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
    this.gridHighlightMesh.position.y = 0.04;
    this.gridHighlightMesh.visible = false;
    this.scene.add(this.gridHighlightMesh);

    // 7b. Continuous Radial Unit Cursor
    this.unitCursorRing = new THREE.Group();
    const uRingGeo = new THREE.RingGeometry(0.45, 0.62, 24);
    uRingGeo.rotateX(-Math.PI / 2);
    const uRingMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const uRingMesh = new THREE.Mesh(uRingGeo, uRingMat);
    this.unitCursorRing.add(uRingMesh);
    this.unitCursorRing.position.y = 0.05;
    this.unitCursorRing.visible = false;
    this.scene.add(this.unitCursorRing);

    // 7c. Selected Tile Marker (for Tile -> Card building flow)
    this.selectedTileMesh = new THREE.Group();
    const selFillGeo = new THREE.PlaneGeometry(0.92, 0.92);
    selFillGeo.rotateX(-Math.PI / 2);
    const selFillMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    const selFill = new THREE.Mesh(selFillGeo, selFillMat);

    const selRingGeo = new THREE.RingGeometry(0.36, 0.48, 4);
    selRingGeo.rotateX(-Math.PI / 2);
    selRingGeo.rotateY(Math.PI / 4);
    const selRingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const selRing = new THREE.Mesh(selRingGeo, selRingMat);
    selRing.position.y = 0.01;

    this.selectedTileMesh.add(selFill, selRing);
    this.selectedTileMesh.position.y = 0.045;
    this.selectedTileMesh.visible = false;
    this.scene.add(this.selectedTileMesh);

    // 8. Bind Mouse, Touch, Box-Select & Wheel Events
    this.bindEvents();

    // 9. Initial Camera Framing
    this.snapCameraFull();
    this.currentLookAt.copy(this.targetLookAt);
    this.currentAzimuth = this.targetAzimuth;
    this.currentPolar = this.targetPolar;
    this.currentDistance = this.targetDistance;
    this.updateCameraFromSpherical();

    // 10. Start Animation Loop
    this.tick = this.tick.bind(this);
    this.animFrameId = requestAnimationFrame(this.tick);
  }

  private buildMoveMarker() {
    const outerRingGeo = new THREE.RingGeometry(0.55, 0.72, 24);
    outerRingGeo.rotateX(-Math.PI / 2);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerMat);
    outerRing.position.y = 0.05;
    outerRing.name = 'moveOuterRing';

    const innerRingGeo = new THREE.RingGeometry(0.2, 0.32, 24);
    innerRingGeo.rotateX(-Math.PI / 2);
    const innerRing = new THREE.Mesh(innerRingGeo, outerMat);
    innerRing.position.y = 0.055;

    // Downward pointing low-poly crystal chevron
    const pointerGeo = new THREE.ConeGeometry(0.22, 0.55, 4);
    pointerGeo.rotateX(Math.PI);
    const pointerMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      emissive: 0x16a34a,
      emissiveIntensity: 0.6,
      flatShading: true,
    });
    const pointerMesh = new THREE.Mesh(pointerGeo, pointerMat);
    pointerMesh.position.y = 0.55;
    pointerMesh.name = 'movePointer';

    this.moveMarkerGroup.add(outerRing, innerRing, pointerMesh);
    this.moveMarkerGroup.visible = false;
  }

  public showMoveOrderMarker(worldX: number, worldZ: number) {
    this.moveMarkerGroup.position.set(worldX, 0, worldZ);
    this.moveMarkerGroup.visible = true;
    this.moveMarkerTimer = 1.6;
  }

  // ============================================================================
  // RTS UNIT SELECTION API
  // ============================================================================

  public getSelectedUnitIds(): string[] {
    return Array.from(this.selectedUnitIds);
  }

  public setSelectedUnitIds(ids: string[]) {
    this.selectedUnitIds = new Set(ids);
    this.callbacks.onSelectionChange?.(Array.from(this.selectedUnitIds));
  }

  public clearUnitSelection() {
    if (this.selectedUnitIds.size > 0) {
      this.selectedUnitIds.clear();
      this.callbacks.onSelectionChange?.([]);
    }
  }

  public selectAllFriendlyUnits(onlyIdle = false): string[] {
    if (!this.latestState) return [];
    const matching = this.latestState.units
      .filter(
        (u) =>
          u.faction === this.playerFaction &&
          u.state !== 'ko' &&
          (!onlyIdle || u.state === 'idle')
      )
      .map((u) => u.id);
    this.selectedUnitIds = new Set(matching);
    this.callbacks.onSelectionChange?.(matching);
    return matching;
  }

  public setPlayerFaction(faction: Faction) {
    this.playerFaction = faction;
    this.snapCameraFull();
    if (this.latestState) {
      this.rebuildSpawnCircles(this.latestState);
    }
  }

  public setShowSpawnRings(show: boolean) {
    this.showSpawnRings = show;
    this.spawnCirclesGroup.visible = show || Boolean(this.placementSelection);
  }

  public setSelectedTile(tile: { x: number; z: number } | null) {
    this.selectedTile = tile;
    if (tile) {
      this.selectedTileMesh.position.set(tile.x + 0.5, 0.045, tile.z + 0.5);
      this.selectedTileMesh.visible = true;
    } else {
      this.selectedTileMesh.visible = false;
    }
  }

  public setPlacementSelection(selection: PlacementSelection) {
    this.placementSelection = selection;
    this.spawnCirclesGroup.visible = Boolean(selection) || this.showSpawnRings;
    if (this.ghostMesh) {
      this.scene.remove(this.ghostMesh);
      this.ghostMesh = null;
    }
    this.unitCursorRing.visible = false;
    this.gridHighlightMesh.visible = false;
    if (selection) {
      if (selection.kind === 'building') {
        this.ghostMesh = this.createGhostForBuilding(selection.type);
      } else {
        this.ghostMesh = this.createGhostForUnit(selection.type);
      }
      this.ghostMesh.visible = false;
      this.scene.add(this.ghostMesh);
    }
  }

  private createGhostForBuilding(type: BuildingType): THREE.Group {
    let group: THREE.Group;
    if (type === 'barracks') group = createBarracksMesh(this.playerFaction, 1);
    else if (type === 'refinery') group = createRefineryMesh(this.playerFaction, 1);
    else if (type === 'cannon_tower') group = createCannonTowerMesh(this.playerFaction, 1);
    else if (type === 'arc_spire') group = createArcSpireMesh(this.playerFaction, 1);
    else group = createCapitalMesh(this.playerFaction);

    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshBasicMaterial({
          color: 0x10b981,
          transparent: true,
          opacity: 0.65,
        });
      }
    });
    return group;
  }

  private createGhostForUnit(type: UnitType): THREE.Group {
    const group = createUnitMesh(this.playerFaction, type, 1);
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshBasicMaterial({
          color: 0x10b981,
          transparent: true,
          opacity: 0.72,
        });
      }
    });
    return group;
  }

  // ============================================================================
  // 360° ORBIT CAMERA, PITCH TILT, ZOOM & COMPASS GIZMO API
  // ============================================================================

  public setDragMode(mode: 'select' | 'pan' | 'orbit') {
    this.dragMode = mode;
    this.emitCameraTelemetry(true);
  }

  public getDragMode(): 'select' | 'pan' | 'orbit' {
    return this.dragMode;
  }

  public panBy(worldDx: number, worldDz: number) {
    const sinA = Math.sin(this.currentAzimuth);
    const cosA = Math.cos(this.currentAzimuth);
    const rx = worldDx * cosA - worldDz * sinA;
    const rz = -worldDx * sinA - worldDz * cosA;
    this.targetLookAt.x = THREE.MathUtils.clamp(this.targetLookAt.x + rx, -2.0, GRID_COLS + 2.0);
    this.targetLookAt.z = THREE.MathUtils.clamp(this.targetLookAt.z + rz, -2.0, GRID_ROWS + 2.0);
  }

  public orbitBy(deltaAzimuthRad: number, deltaPolarRad = 0) {
    this.targetAzimuth += deltaAzimuthRad;
    this.targetPolar = THREE.MathUtils.clamp(this.targetPolar + deltaPolarRad, 0.28, 1.18);
    this.emitCameraTelemetry(true);
  }

  public resetNorth() {
    const isPortrait = this.camera.aspect < 0.85;
    const defaultAz = isPortrait
      ? this.playerFaction === 'royal'
        ? -Math.PI / 2
        : Math.PI / 2
      : 0;
    const twoPi = Math.PI * 2;
    this.currentAzimuth = ((this.currentAzimuth + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
    this.targetAzimuth = defaultAz;
    this.targetPolar = isPortrait ? 0.62 : 0.72;
    this.emitCameraTelemetry(true);
  }

  public cyclePitchPreset() {
    if (this.targetPolar < 0.5) {
      this.targetPolar = 0.72;
    } else if (this.targetPolar < 0.9) {
      this.targetPolar = 1.08;
    } else {
      this.targetPolar = 0.34;
    }
    this.emitCameraTelemetry(true);
  }

  public zoomBy(delta: number) {
    this.targetDistance = THREE.MathUtils.clamp(this.targetDistance + delta, 9.0, 48.0);
    this.emitCameraTelemetry(true);
  }

  public snapCameraToBase() {
    this.currentCameraMode = 'base';
    const isPortrait = this.camera.aspect < 0.85;
    const baseX = this.playerFaction === 'royal' ? 7.0 : 25.0;
    this.targetLookAt.set(baseX, 0, 10.0);
    this.targetDistance = isPortrait ? 24.0 : 18.5;
    this.targetPolar = 0.65;
    this.emitCameraTelemetry(true);
  }

  public snapCameraToCenter() {
    this.currentCameraMode = 'center';
    const isPortrait = this.camera.aspect < 0.85;
    this.targetLookAt.set(16.0, 0, 10.0);
    this.targetDistance = isPortrait ? 25.0 : 19.5;
    this.targetPolar = 0.65;
    this.emitCameraTelemetry(true);
  }

  public snapCameraFull() {
    this.currentCameraMode = 'full';
    const isPortrait = this.camera.aspect < 0.85;
    if (isPortrait) {
      this.targetAzimuth = this.playerFaction === 'royal' ? -Math.PI / 2 : Math.PI / 2;
      this.targetLookAt.set(15.5, 0, 10.0);
      this.targetDistance = 31.0;
      this.targetPolar = 0.6;
    } else {
      this.targetAzimuth = 0;
      this.targetLookAt.set(16.0, 0, 10.4);
      this.targetDistance = 29.5;
      this.targetPolar = 0.72;
    }
    this.emitCameraTelemetry(true);
  }

  private updateCameraFromSpherical() {
    const sinPhi = Math.sin(this.currentPolar);
    const cosPhi = Math.cos(this.currentPolar);
    const sinTheta = Math.sin(this.currentAzimuth);
    const cosTheta = Math.cos(this.currentAzimuth);

    this.camera.position.set(
      this.currentLookAt.x + this.currentDistance * sinPhi * sinTheta,
      this.currentLookAt.y + this.currentDistance * cosPhi,
      this.currentLookAt.z + this.currentDistance * sinPhi * cosTheta
    );
    this.camera.lookAt(this.currentLookAt);
  }

  private emitCameraTelemetry(force = false) {
    if (!this.callbacks.onCameraChange) return;
    const azDeg = Math.round(((this.targetAzimuth * 180) / Math.PI) % 360);
    const normalizedAz = (azDeg + 360) % 360;
    const pitchDeg = Math.round((this.targetPolar * 180) / Math.PI);
    const zoomPct = Math.round(((48.0 - this.targetDistance) / (48.0 - 9.0)) * 100);

    if (
      force ||
      normalizedAz !== this.lastEmittedAzimuth ||
      pitchDeg !== this.lastEmittedPolar ||
      zoomPct !== this.lastEmittedDist
    ) {
      this.lastEmittedAzimuth = normalizedAz;
      this.lastEmittedPolar = pitchDeg;
      this.lastEmittedDist = zoomPct;
      this.callbacks.onCameraChange({
        azimuthDeg: normalizedAz,
        pitchDeg,
        zoomPct,
        dragMode: this.dragMode,
        cameraMode: this.currentCameraMode,
      });
    }
  }

  // ============================================================================
  // RADIAL CIRCULAR SPAWN ZONE RINGS & TERRITORY HIGHLIGHT
  // ============================================================================

  private lastSpawnCircleSignature = '';

  private rebuildSpawnCircles(state: BattleState) {
    const circles: SpawnCircle[] = getValidSpawnCircles(state, this.playerFaction);
    const sig = `${this.playerFaction}:${circles.map((c) => `${c.x.toFixed(1)},${c.z.toFixed(1)},${c.radius}`).join('|')}`;
    if (sig === this.lastSpawnCircleSignature) return;
    this.lastSpawnCircleSignature = sig;

    while (this.spawnCirclesGroup.children.length > 0) {
      const child = this.spawnCirclesGroup.children[0];
      this.spawnCirclesGroup.remove(child);
    }

    const isRoyal = this.playerFaction === 'royal';
    const primaryColor = isRoyal ? 0x10b981 : 0xef4444;
    const accentColor = isRoyal ? 0x34d399 : 0xf97316;

    // Territory Floor Highlight Box so mobile players clearly see where they can place buildings & troops
    const terrWidth = 13;
    const terrDepth = 20;
    const terrCenterX = isRoyal ? 6.5 : 25.5;
    const terrGeo = new THREE.PlaneGeometry(terrWidth, terrDepth);
    terrGeo.rotateX(-Math.PI / 2);
    const terrMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    const terrMesh = new THREE.Mesh(terrGeo, terrMat);
    terrMesh.position.set(terrCenterX, 0.028, 10.0);
    this.spawnCirclesGroup.add(terrMesh);

    for (const c of circles) {
      const ringGroup = new THREE.Group();
      ringGroup.position.set(c.x, 0.032, c.z);

      const fillGeo = new THREE.CircleGeometry(c.radius, 36);
      fillGeo.rotateX(-Math.PI / 2);
      const fillMat = new THREE.MeshBasicMaterial({
        color: primaryColor,
        transparent: true,
        opacity: c.sourceType === 'capital' ? 0.08 : 0.06,
        depthWrite: false,
      });
      const fillMesh = new THREE.Mesh(fillGeo, fillMat);

      const outerGeo = new THREE.RingGeometry(c.radius - 0.12, c.radius, 48);
      outerGeo.rotateX(-Math.PI / 2);
      const outerMat = new THREE.MeshBasicMaterial({
        color: accentColor,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const outerMesh = new THREE.Mesh(outerGeo, outerMat);
      outerMesh.position.y = 0.005;

      ringGroup.add(fillMesh, outerMesh);
      this.spawnCirclesGroup.add(ringGroup);
    }
  }

  // ============================================================================
  // LOW-POLY FOREST LAND WITH CASTLES BUILDER
  // ============================================================================

  private createStreamTexture(isHighland: boolean): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 256, 0);
    if (isHighland) {
      grad.addColorStop(0, '#0284c7');
      grad.addColorStop(0.25, '#0369a1');
      grad.addColorStop(0.5, '#075985');
      grad.addColorStop(0.75, '#0369a1');
      grad.addColorStop(1, '#0284c7');
    } else {
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(0.25, '#0ea5e9');
      grad.addColorStop(0.5, '#0284c7');
      grad.addColorStop(0.75, '#0ea5e9');
      grad.addColorStop(1, '#38bdf8');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 512);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
    for (let i = 0; i < 36; i++) {
      const rx = 20 + ((i * 53) % 210);
      const ry = (i * 47) % 500;
      ctx.beginPath();
      ctx.roundRect(rx, ry, 22, 6, 3);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 5);
    return tex;
  }

  /**
   * Generates a true faceted low-poly terrain mesh with vertex colors and surrounding low-poly mountain ridges!
   */
  private createFacetedForestTerrain(isHighland: boolean): THREE.Mesh {
    const width = 92;
    const depth = 68;
    const segX = 64;
    const segZ = 48;

    const baseGeo = new THREE.PlaneGeometry(width, depth, segX, segZ);
    baseGeo.rotateX(-Math.PI / 2);
    // Translate so center matches battlefield center (16, 0, 10)
    baseGeo.translate(16.0, 0, 10.0);

    // Convert to non-indexed so every triangle facet gets crisp flat shading & distinct low-poly colors
    const geo = baseGeo.toNonIndexed();
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    // Deterministic pseudo-random height function so shared vertices stay seamless!
    const heightAt = (wx: number, wz: number): number => {
      // River channel depression at X: 14.3..17.7
      const crossings = isHighland ? [3.0, 10.0, 17.0] : [3.5, 10.0, 16.5];
      const onCrossing = crossings.some((cz, idx) => Math.abs(wz - cz) < (idx === 1 ? 2.6 : 1.9));
      if (wx > 14.2 && wx < 17.8 && !onCrossing) {
        return -0.35;
      }

      // Playable 32x20 valley floor (X: -0.5..32.5, Z: -0.5..20.5) stays nearly flat with subtle low-poly facet undulation
      const dxOut = Math.max(0, -0.5 - wx, wx - 32.5);
      const dzOut = Math.max(0, -0.5 - wz, wz - 20.5);
      const outDist = Math.hypot(dxOut, dzOut);

      const wave =
        Math.sin(wx * 0.45 + wz * 0.35) * 0.04 +
        Math.cos(wx * 0.8 - wz * 0.65) * 0.03;

      if (outDist <= 0.01) {
        return wave * 0.45;
      }

      // Outer perimeter rises into sculpted low-poly forest hills & mountain peaks
      const hill =
        Math.min(6.5, Math.pow(outDist * 0.28, 1.45)) +
        Math.sin(wx * 0.32) * Math.cos(wz * 0.28) * Math.min(1.8, outDist * 0.18);
      return hill + wave;
    };

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      pos.setY(i, heightAt(vx, vz));
    }

    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 3) {
      const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
      const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
      const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;

      const facetNoise = Math.sin(cx * 1.7 + cz * 2.3) * 0.5 + 0.5;

      // Castle Stone Courtyards around West Castle (3, 10) and East Castle (29, 10)
      const distRoyalCastle = Math.hypot(cx - 3.8, cz - 10.0);
      const distInfernalCastle = Math.hypot(cx - 28.2, cz - 10.0);

      if (cy > 2.4) {
        // High rocky low-poly mountain peaks
        c.setHex(facetNoise > 0.55 ? 0x94a3b8 : 0x64748b);
      } else if (cy > 0.7) {
        // Forested hill slopes
        c.setHex(facetNoise > 0.5 ? 0x15803d : 0x166534);
      } else if (distRoyalCastle < 4.2) {
        // Royal Castle Courtyard & Garrison Clearing
        c.setHex(facetNoise > 0.5 ? 0x86efac : 0x4ade80);
      } else if (distInfernalCastle < 4.2) {
        // Crimson Castle Courtyard & Garrison Clearing
        c.setHex(isHighland ? (facetNoise > 0.5 ? 0x4ade80 : 0x22c55e) : (facetNoise > 0.5 ? 0x86efac : 0x4ade80));
      } else if (Math.abs(cx - 16.0) < 2.2) {
        // Riverbank / Stone Fordmossy stones
        c.setHex(facetNoise > 0.5 ? 0x6ee7b7 : 0x34d399);
      } else {
        // Lush low-poly forest floor facets
        if (isHighland) {
          c.setHex(facetNoise > 0.66 ? 0x4ade80 : facetNoise > 0.33 ? 0x22c55e : 0x16a34a);
        } else {
          c.setHex(facetNoise > 0.66 ? 0x86efac : facetNoise > 0.33 ? 0x4ade80 : 0x22c55e);
        }
      }

      for (let v = 0; v < 3; v++) {
        colors[(i + v) * 3] = c.r;
        colors[(i + v) * 3 + 1] = c.g;
        colors[(i + v) * 3 + 2] = c.b;
      }
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.86,
      metalness: 0.02,
      flatShading: true,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  /**
   * Builds a multi-part low-poly pine or deciduous oak tree
   */
  private createLowPolyTree(variant: 'pine' | 'oak', scale = 1.0, tintIdx = 0): THREE.Group {
    const tree = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.9,
      flatShading: true,
    });
    const pineColors = [0x15803d, 0x16a34a, 0x22c55e, 0x166534];
    const leafMat1 = new THREE.MeshStandardMaterial({
      color: pineColors[tintIdx % pineColors.length],
      roughness: 0.8,
      flatShading: true,
    });
    const leafMat2 = new THREE.MeshStandardMaterial({
      color: pineColors[(tintIdx + 1) % pineColors.length],
      roughness: 0.78,
      flatShading: true,
    });

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11 * scale, 0.17 * scale, 0.75 * scale, 6),
      trunkMat
    );
    trunk.position.y = 0.37 * scale;
    trunk.castShadow = true;
    tree.add(trunk);

    if (variant === 'pine') {
      const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.65 * scale, 1.05 * scale, 6), leafMat1);
      c1.position.y = 0.95 * scale;
      c1.castShadow = true;

      const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.5 * scale, 0.9 * scale, 6), leafMat2);
      c2.position.y = 1.45 * scale;
      c2.castShadow = true;

      const c3 = new THREE.Mesh(new THREE.ConeGeometry(0.34 * scale, 0.72 * scale, 6), leafMat1);
      c3.position.y = 1.88 * scale;
      c3.castShadow = true;

      tree.add(c1, c2, c3);
    } else {
      // Faceted Low-Poly Deciduous Oak Crown
      const mainCrown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.58 * scale, 0), leafMat1);
      mainCrown.position.set(0, 1.15 * scale, 0);
      mainCrown.castShadow = true;

      const subCrown1 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 * scale, 0), leafMat2);
      subCrown1.position.set(0.32 * scale, 0.98 * scale, 0.2 * scale);
      subCrown1.castShadow = true;

      const subCrown2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38 * scale, 0), leafMat2);
      subCrown2.position.set(-0.28 * scale, 1.04 * scale, -0.22 * scale);
      subCrown2.castShadow = true;

      tree.add(mainCrown, subCrown1, subCrown2);
    }

    return tree;
  }

  /**
   * Builds outer Castle Curtain Walls & Watchtowers behind each faction's Keep so both bases look like grand Castles in the forest!
   */
  private addCastlePerimeterFortifications() {
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.78,
      flatShading: true,
    });
    const darkStoneMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.85,
      flatShading: true,
    });
    const blueRoofMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.45,
      flatShading: true,
    });
    const redRoofMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.45,
      flatShading: true,
    });

    // West Royal Castle Outer Bastion Towers & Gate Walls
    const royalBastionZ = [2.5, 6.2, 13.8, 17.5];
    royalBastionZ.forEach((bz) => {
      const tower = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.56, 2.2, 7), stoneMat);
      shaft.position.y = 1.1;
      shaft.castShadow = true;
      shaft.receiveShadow = true;

      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.95, 7), blueRoofMat);
      roof.position.y = 2.65;
      roof.castShadow = true;

      tower.add(shaft, roof);
      tower.position.set(-0.6, 0, bz);
      this.battlefieldGroup.add(tower);
    });

    // East Infernal Castle Outer Bastion Towers
    royalBastionZ.forEach((bz) => {
      const tower = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.56, 2.2, 7), darkStoneMat);
      shaft.position.y = 1.1;
      shaft.castShadow = true;
      shaft.receiveShadow = true;

      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.95, 7), redRoofMat);
      roof.position.y = 2.65;
      roof.castShadow = true;

      tower.add(shaft, roof);
      tower.position.set(32.6, 0, bz);
      this.battlefieldGroup.add(tower);
    });
  }

  public setMap(mapId: MapId) {
    if (this.currentMapId === mapId) return;
    this.currentMapId = mapId;
    this.buildBattlefield(mapId);
  }

  private clearBattlefield() {
    while (this.battlefieldGroup.children.length > 0) {
      const obj = this.battlefieldGroup.children[0];
      this.battlefieldGroup.remove(obj);
      if ((obj as THREE.Mesh).geometry) {
        (obj as THREE.Mesh).geometry.dispose();
      }
    }
  }

  private buildBattlefield(mapId: MapId = this.currentMapId) {
    this.clearBattlefield();
    const isHighland = mapId === 'ironhold_chasm';

    this.scene.background = new THREE.Color(isHighland ? 0xbae6fd : 0xdbeafe);
    this.scene.fog = new THREE.Fog(isHighland ? 0xbae6fd : 0xdbeafe, 44, 96);

    // 1. Faceted Low-Poly Forest & Mountain Valley Terrain
    const terrain = this.createFacetedForestTerrain(isHighland);
    this.battlefieldGroup.add(terrain);

    // 2. Crystal Forest Stream in Center (X: 14.3..17.7)
    this.riverTexture = this.createStreamTexture(isHighland);
    const streamMat = new THREE.MeshStandardMaterial({
      map: this.riverTexture,
      color: 0xffffff,
      roughness: 0.16,
      metalness: 0.15,
    });
    const stream = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 60.0), streamMat);
    stream.rotation.x = -Math.PI / 2;
    stream.position.set(16.0, -0.14, 10.0);
    this.battlefieldGroup.add(stream);

    // 3. Three Wide Low-Poly Woodland Stone & Timber Fords / Bridges
    const crossingZs = isHighland ? [3.0, 10.0, 17.0] : [3.5, 10.0, 16.5];
    const stoneBridgeMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.75,
      flatShading: true,
    });
    const timberDeckMat = new THREE.MeshStandardMaterial({
      color: 0x92400e,
      roughness: 0.82,
      flatShading: true,
    });
    const mossRockMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.85,
      flatShading: true,
    });

    crossingZs.forEach((cz, idx) => {
      const isCenter = idx === 1;
      const widthZ = isCenter ? 4.4 : 3.2;

      const causeway = new THREE.Mesh(
        new THREE.BoxGeometry(4.4, 0.22, widthZ),
        isCenter ? stoneBridgeMat : timberDeckMat
      );
      causeway.position.set(16.0, -0.02, cz);
      causeway.receiveShadow = true;
      causeway.castShadow = true;
      this.battlefieldGroup.add(causeway);

      // Low-poly stone bridge pillars on edges of the crossing
      [-widthZ / 2 + 0.15, widthZ / 2 - 0.15].forEach((dz) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.24, 0.2), stoneBridgeMat);
        rail.position.set(16.0, 0.14, cz + dz);
        rail.castShadow = true;
        this.battlefieldGroup.add(rail);
      });
    });

    // 4. Castle Courtyard Plinths & Outer Castle Perimeter Bastions
    const courtyardMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.8,
      flatShading: true,
    });
    const westCourtyard = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 0.12, 8), courtyardMat);
    westCourtyard.position.set(3.5, -0.02, 10.0);
    westCourtyard.receiveShadow = true;

    const eastCourtyard = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 0.12, 8), courtyardMat);
    eastCourtyard.position.set(28.5, -0.02, 10.0);
    eastCourtyard.receiveShadow = true;
    this.battlefieldGroup.add(westCourtyard, eastCourtyard);

    this.addCastlePerimeterFortifications();

    // 5. Dense Low-Poly Forest Groves (Pine & Oak Trees + Mossy Rocks)
    const forestSpots: Array<[number, number, 'pine' | 'oak', number]> = [
      // Northern forest ridge
      [2.0, -2.2, 'pine', 1.35], [5.2, -1.8, 'oak', 1.2], [8.8, -2.5, 'pine', 1.45],
      [12.4, -1.6, 'pine', 1.15], [16.0, -2.4, 'oak', 1.3], [19.6, -1.7, 'pine', 1.25],
      [23.2, -2.5, 'pine', 1.4], [26.8, -1.9, 'oak', 1.2], [30.2, -2.2, 'pine', 1.35],
      [0.5, -4.5, 'pine', 1.6], [7.0, -4.8, 'pine', 1.5], [14.0, -4.2, 'oak', 1.45],
      [21.0, -4.6, 'pine', 1.55], [28.0, -4.4, 'pine', 1.6],

      // Southern forest ridge
      [2.0, 22.2, 'pine', 1.35], [5.2, 21.8, 'oak', 1.25], [8.8, 22.5, 'pine', 1.4],
      [12.4, 21.6, 'pine', 1.15], [16.0, 22.4, 'oak', 1.3], [19.6, 21.7, 'pine', 1.25],
      [23.2, 22.5, 'pine', 1.4], [26.8, 21.9, 'oak', 1.2], [30.2, 22.2, 'pine', 1.35],
      [1.5, 24.5, 'pine', 1.6], [9.0, 24.8, 'pine', 1.5], [17.0, 24.2, 'oak', 1.45],
      [24.0, 24.6, 'pine', 1.55], [30.5, 24.4, 'pine', 1.6],

      // Behind West Royal Castle
      [-2.4, 0.8, 'pine', 1.4], [-3.2, 4.5, 'oak', 1.3], [-2.8, 8.2, 'pine', 1.45],
      [-2.8, 11.8, 'pine', 1.45], [-3.2, 15.5, 'oak', 1.3], [-2.4, 19.2, 'pine', 1.4],

      // Behind East Crimson Castle
      [34.4, 0.8, 'pine', 1.4], [35.2, 4.5, 'oak', 1.3], [34.8, 8.2, 'pine', 1.45],
      [34.8, 11.8, 'pine', 1.45], [35.2, 15.5, 'oak', 1.3], [34.4, 19.2, 'pine', 1.4],

      // Scenic woodland clusters along the stream banks (between crossings)
      [13.7, 6.6, 'pine', 0.95], [18.3, 6.6, 'oak', 0.92],
      [13.7, 13.4, 'oak', 0.92], [18.3, 13.4, 'pine', 0.95],
      [13.6, 0.7, 'pine', 1.05], [18.4, 0.7, 'pine', 1.05],
      [13.6, 19.3, 'pine', 1.05], [18.4, 19.3, 'pine', 1.05],
    ];

    forestSpots.forEach(([tx, tz, kind, s], idx) => {
      const tree = this.createLowPolyTree(kind, s, idx);
      tree.position.set(tx, -0.04, tz);
      tree.rotation.y = (idx * 1.7) % (Math.PI * 2);
      this.battlefieldGroup.add(tree);
    });

    // 6. Low-Poly Mossy Boulders & Forest Stumps
    const rockSpots = [
      [13.4, 7.2, 0.48], [18.6, 7.2, 0.52],
      [13.4, 12.8, 0.5], [18.6, 12.8, 0.46],
      [9.5, 0.6, 0.55], [22.5, 0.6, 0.55],
      [9.5, 19.4, 0.55], [22.5, 19.4, 0.55],
      [-1.8, 10.0, 0.75], [33.8, 10.0, 0.75],
    ];

    rockSpots.forEach(([rx, rz, rScale], i) => {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rScale, 0), mossRockMat);
      rock.position.set(rx, rScale * 0.35, rz);
      rock.scale.set(1.25, 0.78, 1.05);
      rock.rotation.y = i * 1.1;
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.battlefieldGroup.add(rock);
    });
  }

  private createSovereignSiphonMesh(radius = 2.4): THREE.Group {
    const group = new THREE.Group();
    const scale = radius / 2.4;

    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.75,
      flatShading: true,
    });
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(1.35 * scale, 1.55 * scale, 0.2, 7),
      plinthMat
    );
    plinth.position.y = 0.1;
    plinth.receiveShadow = true;
    plinth.castShadow = true;

    const ringGeo = new THREE.RingGeometry(radius - 0.3, radius, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beaconRing = new THREE.Mesh(ringGeo, ringMat);
    beaconRing.name = 'beaconRing';
    beaconRing.position.y = 0.04;

    // Low-poly Standing Runestones around Shrine
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.8,
      flatShading: true,
    });
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const px = Math.cos(angle) * 1.12 * scale;
      const pz = Math.sin(angle) * 1.12 * scale;
      const runestone = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.92 * scale, 5),
        stoneMat
      );
      runestone.position.set(px, 0.46 * scale, pz);
      runestone.castShadow = true;
      group.add(runestone);
    }

    const crystalGeo = new THREE.OctahedronGeometry(0.42 * scale, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: new THREE.Color(0xd97706),
      emissiveIntensity: 0.75,
      roughness: 0.2,
      metalness: 0.8,
      flatShading: true,
    });
    const coreCrystal = new THREE.Mesh(crystalGeo, crystalMat);
    coreCrystal.name = 'coreCrystal';
    coreCrystal.position.y = 1.28 * scale;
    coreCrystal.castShadow = true;

    group.add(plinth, beaconRing, coreCrystal);
    return group;
  }

  private syncNeutralObjectives(objectives: NeutralObjectiveState[]) {
    const activeIds = new Set<string>();

    for (const obj of objectives) {
      activeIds.add(obj.id);
      let group = this.neutralObjectiveMeshes.get(obj.id);

      if (!group) {
        group = this.createSovereignSiphonMesh(obj.radius);
        group.position.set(obj.x, 0, obj.z);
        this.scene.add(group);
        this.neutralObjectiveMeshes.set(obj.id, group);
      }

      const beaconRing = group.getObjectByName('beaconRing') as THREE.Mesh;
      if (beaconRing && beaconRing.material) {
        const mat = beaconRing.material as THREE.MeshBasicMaterial;
        if (obj.owner === 'royal') {
          mat.color.setHex(0x3b82f6);
          mat.opacity = 0.8;
        } else if (obj.owner === 'infernal') {
          mat.color.setHex(0xef4444);
          mat.opacity = 0.8;
        } else {
          mat.color.setHex(0xf59e0b);
          mat.opacity = 0.45 + Math.abs(obj.captureProgress / 100) * 0.35;
        }
      }

      const coreCrystal = group.getObjectByName('coreCrystal') as THREE.Mesh;
      if (coreCrystal && coreCrystal.material) {
        const mat = coreCrystal.material as THREE.MeshStandardMaterial;
        if (obj.owner === 'royal') {
          mat.color.setHex(0x93c5fd);
          mat.emissive.setHex(0x2563eb);
          mat.emissiveIntensity = 0.95;
        } else if (obj.owner === 'infernal') {
          mat.color.setHex(0xfca5a5);
          mat.emissive.setHex(0xdc2626);
          mat.emissiveIntensity = 0.95;
        } else {
          mat.color.setHex(0xfef08a);
          mat.emissive.setHex(0xd97706);
          mat.emissiveIntensity = 0.65;
        }
      }
    }

    for (const [id, group] of this.neutralObjectiveMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.neutralObjectiveMeshes.delete(id);
      }
    }
  }

  // ============================================================================
  // POINTER, RTS BOX SELECTION, MOVE COMMANDS & CAMERA GESTURES
  // ============================================================================

  private bindEvents() {
    const el = this.renderer.domElement;

    el.addEventListener('contextmenu', (e) => e.preventDefault());

    el.addEventListener('pointermove', (e) => {
      this.updateMouseCoords(e);
      this.handleHover();

      if (this.isDragging) {
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;

        if (this.activePointerAction === 'select') {
          if (Math.hypot(dx, dy) >= 6) {
            const rect = el.getBoundingClientRect();
            const x1 = this.dragStart.x - rect.left;
            const y1 = this.dragStart.y - rect.top;
            const x2 = e.clientX - rect.left;
            const y2 = e.clientY - rect.top;
            this.callbacks.onSelectBoxUpdate?.({
              x: Math.min(x1, x2),
              y: Math.min(y1, y2),
              w: Math.abs(x2 - x1),
              h: Math.abs(y2 - y1),
            });
          }
        } else if (this.activePointerAction === 'orbit') {
          this.targetAzimuth = this.azimuthStart - dx * 0.0075;
          this.targetPolar = THREE.MathUtils.clamp(this.polarStart - dy * 0.006, 0.28, 1.18);
          this.emitCameraTelemetry();
        } else {
          const panScale = this.targetDistance * 0.0014;
          const sinA = Math.sin(this.currentAzimuth);
          const cosA = Math.cos(this.currentAzimuth);

          const worldDx = -dx * cosA * panScale + dy * sinA * panScale;
          const worldDz = dx * sinA * panScale + dy * cosA * panScale;

          this.targetLookAt.x = THREE.MathUtils.clamp(
            this.lookAtStart.x + worldDx,
            -2.0,
            GRID_COLS + 2.0
          );
          this.targetLookAt.z = THREE.MathUtils.clamp(
            this.lookAtStart.z + worldDz,
            -2.0,
            GRID_ROWS + 2.0
          );
        }
      }
    });

    el.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.lookAtStart.copy(this.targetLookAt);
      this.azimuthStart = this.targetAzimuth;
      this.polarStart = this.targetPolar;

      this.updateMouseCoords(e);
      this.handleHover();

      if (e.button === 2) {
        this.activePointerAction = 'orbit';
      } else if (e.button === 1 || e.altKey) {
        this.activePointerAction = 'pan';
      } else {
        // RTS Mouse Box Selection: Left-dragging always draws a selection box to select soldiers
        this.activePointerAction = 'select';
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (!this.isDragging) return;
      const dist = Math.hypot(e.clientX - this.dragStart.x, e.clientY - this.dragStart.y);
      const actionWas = this.activePointerAction;
      this.isDragging = false;
      this.callbacks.onSelectBoxUpdate?.(null);

      // Case 1: Completed an RTS Marquee Drag Box Selection
      if (actionWas === 'select' && dist >= 8 && e.button === 0) {
        this.performBoxSelection(this.dragStart.x, this.dragStart.y, e.clientX, e.clientY, e.shiftKey);
        return;
      }

      // Case 2: Right-Click (no drag) -> Direct Move Order for selected troops
      if (dist < 8 && e.button === 2) {
        this.updateMouseCoords(e);
        this.handleHover();
        if (this.hoveredWorldPoint && this.selectedUnitIds.size > 0) {
          const ids = Array.from(this.selectedUnitIds);
          this.showMoveOrderMarker(this.hoveredWorldPoint.x, this.hoveredWorldPoint.z);
          this.callbacks.onMoveUnitsCommand?.(
            ids,
            this.hoveredWorldPoint.x,
            this.hoveredWorldPoint.z
          );
          this.clearUnitSelection();
        }
        return;
      }

      // Case 3: Tap / Left-Click (no drag)
      if (dist < 8 && e.button === 0) {
        this.updateMouseCoords(e);
        this.handleHover();
        this.handleClick(e.shiftKey);
      }
    });

    // Two-finger Pinch-to-Zoom AND Two-finger Twist-to-Rotate on touch devices
    el.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        this.isDragging = false;
        this.callbacks.onSelectBoxUpdate?.(null);
        this.touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        this.touchStartAngle = Math.atan2(
          e.touches[1].clientY - e.touches[0].clientY,
          e.touches[1].clientX - e.touches[0].clientX
        );
      }
    });

    el.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && this.touchStartDist > 0) {
        const newDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const deltaDist = newDist - this.touchStartDist;
        this.touchStartDist = newDist;
        this.zoomBy(deltaDist * -0.055);

        const newAngle = Math.atan2(
          e.touches[1].clientY - e.touches[0].clientY,
          e.touches[1].clientX - e.touches[0].clientX
        );
        let deltaAngle = newAngle - this.touchStartAngle;
        if (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
        if (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
        this.touchStartAngle = newAngle;
        this.orbitBy(-deltaAngle * 0.85, 0);
      }
    });

    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoomBy(e.deltaY * 0.022);
      },
      { passive: false }
    );

    window.addEventListener('resize', () => {
      if (!this.container) return;
      const w = this.container.clientWidth;
      const h = Math.max(1, this.container.clientHeight);
      const wasPortrait = this.camera.aspect < 0.85;
      const aspect = w / h;
      const isPortrait = aspect < 0.85;
      this.camera.aspect = aspect;
      this.camera.fov =
        aspect < 0.9 ? THREE.MathUtils.clamp(40 / Math.pow(aspect, 0.52), 40, 60) : 40;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      if (wasPortrait !== isPortrait) {
        this.snapCameraFull();
      }
    });
  }

  /**
   * Projects all friendly units to 2D canvas coordinates and selects those inside the marquee rectangle
   */
  private performBoxSelection(
    clientX1: number,
    clientY1: number,
    clientX2: number,
    clientY2: number,
    additive = false
  ) {
    if (!this.latestState) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const minX = Math.min(clientX1, clientX2) - rect.left - 14;
    const maxX = Math.max(clientX1, clientX2) - rect.left + 14;
    const minY = Math.min(clientY1, clientY2) - rect.top - 14;
    const maxY = Math.max(clientY1, clientY2) - rect.top + 14;

    const nextSelected = additive ? new Set<string>(this.selectedUnitIds) : new Set<string>();

    for (const u of this.latestState.units) {
      if (u.faction !== this.playerFaction || u.state === 'ko') continue;
      this._projVec.set(u.x, 0.4, u.z);
      this._projVec.project(this.camera);

      const sx = ((this._projVec.x + 1) / 2) * rect.width;
      const sy = ((-this._projVec.y + 1) / 2) * rect.height;

      if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
        nextSelected.add(u.id);
      }
    }

    this.selectedUnitIds = nextSelected;
    this.callbacks.onSelectionChange?.(Array.from(this.selectedUnitIds));
  }

  private updateMouseCoords(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private handleHover() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const point = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, point);

    if (hit) {
      const gx = Math.floor(point.x);
      const gz = Math.floor(point.z);

      if (gx >= 0 && gx < GRID_COLS && gz >= 0 && gz < GRID_ROWS) {
        this.hoveredTile = { x: gx, z: gz };
        this.hoveredWorldPoint = { x: point.x, z: point.z };

        if (this.placementSelection?.kind === 'unit') {
          this.gridHighlightMesh.visible = false;
          this.unitCursorRing.position.set(point.x, 0.05, point.z);
          this.unitCursorRing.visible = true;

          if (this.ghostMesh) {
            this.ghostMesh.position.set(point.x, 0, point.z);
            this.ghostMesh.visible = true;
          }
        } else if (this.placementSelection?.kind === 'building') {
          this.unitCursorRing.visible = false;
          this.gridHighlightMesh.position.set(gx + 0.5, 0.04, gz + 0.5);
          this.gridHighlightMesh.visible = true;

          if (this.ghostMesh) {
            this.ghostMesh.position.set(gx + 0.5, 0, gz + 0.5);
            this.ghostMesh.visible = true;
          }
        } else {
          this.unitCursorRing.visible = false;
          this.gridHighlightMesh.visible = false;
          if (this.ghostMesh) this.ghostMesh.visible = false;
        }

        this.callbacks.onTileHover(gx, gz);
        return;
      }
    }

    this.hoveredTile = null;
    this.hoveredWorldPoint = null;
    this.gridHighlightMesh.visible = false;
    this.unitCursorRing.visible = false;
    if (this.ghostMesh) this.ghostMesh.visible = false;
    this.callbacks.onTileHover(-1, null);
  }

  private handleClick(shiftKey = false) {
    if (!this.hoveredTile || !this.hoveredWorldPoint) return;
    const { x, z } = this.hoveredTile;
    const { x: wx, z: wz } = this.hoveredWorldPoint;

    // 1. If actively placing a building or unit from the dock (2nd click places it on terrain)
    if (this.placementSelection) {
      this.callbacks.onTileClick(x, z, wx, wz);
      return;
    }

    // 2. If soldiers are ALREADY selected, clicking anywhere on the map moves them there!
    if (this.selectedUnitIds.size > 0 && !shiftKey) {
      const ids = Array.from(this.selectedUnitIds);
      this.showMoveOrderMarker(wx, wz);
      this.callbacks.onMoveUnitsCommand?.(ids, wx, wz);
      this.clearUnitSelection();
      return;
    }

    // 3. Otherwise, check if user tapped on/near a friendly soldier to select soldiers (generous mobile touch radius)
    if (this.latestState) {
      let clickedFriendlyUnitId: string | null = null;
      let minUnitDist = 1.5;
      for (const u of this.latestState.units) {
        if (u.faction !== this.playerFaction || u.state === 'ko') continue;
        const d = Math.hypot(u.x - wx, u.z - wz);
        if (d < minUnitDist) {
          minUnitDist = d;
          clickedFriendlyUnitId = u.id;
        }
      }

      if (clickedFriendlyUnitId) {
        const clickedU = this.latestState.units.find((u) => u.id === clickedFriendlyUnitId)!;
        const squadIds = this.latestState.units
          .filter(
            (u) =>
              u.faction === this.playerFaction &&
              u.state !== 'ko' &&
              Math.hypot(u.x - clickedU.x, u.z - clickedU.z) <= 3.2
          )
          .map((u) => u.id);
        this.selectedUnitIds = new Set(squadIds);
        this.callbacks.onSelectionChange?.(Array.from(this.selectedUnitIds));
        this.callbacks.onBuildingClick('');
        return;
      }
    }

    // 4. Otherwise check if user tapped a building to upgrade/sell it
    for (const [id, group] of this.buildingMeshes.entries()) {
      const bx = group.userData.gridX;
      const bz = group.userData.gridZ;
      const w = group.userData.width || 1;
      const h = group.userData.height || 1;
      if (x >= bx && x < bx + w && z >= bz && z < bz + h) {
        this.callbacks.onBuildingClick(id);
        return;
      }
    }

    // 5. Tapped empty terrain
    this.callbacks.onBuildingClick('');
  }

  private updateOrCreateHealthBar(
    id: string,
    faction: Faction,
    x: number,
    y: number,
    z: number,
    hp: number,
    maxHp: number,
    width = 0.85
  ) {
    const pct = Math.max(0, Math.min(1, hp / maxHp));
    let hb = this.healthBars.get(id);

    if (!hb) {
      const group = new THREE.Group();
      const borderGeo = new THREE.PlaneGeometry(width + 0.06, 0.17);
      const borderMat = new THREE.MeshBasicMaterial({
        color: 0x0f172a,
        side: THREE.DoubleSide,
        depthTest: false,
      });
      const border = new THREE.Mesh(borderGeo, borderMat);

      const bgGeo = new THREE.PlaneGeometry(width, 0.11);
      const bgMat = new THREE.MeshBasicMaterial({
        color: 0xe2e8f0,
        side: THREE.DoubleSide,
        depthTest: false,
      });
      const bg = new THREE.Mesh(bgGeo, bgMat);
      bg.position.z = 0.002;

      const fillGeo = new THREE.PlaneGeometry(width, 0.11);
      fillGeo.translate(width / 2, 0, 0);
      const fillMat = new THREE.MeshBasicMaterial({
        color: faction === 'royal' ? 0x2563eb : 0xdc2626,
        side: THREE.DoubleSide,
        depthTest: false,
      });
      const fill = new THREE.Mesh(fillGeo, fillMat);
      fill.position.set(-width / 2, 0, 0.005);

      group.add(border, bg, fill);
      group.renderOrder = 10;
      this.scene.add(group);
      hb = { group, fill, lastPct: pct };
      this.healthBars.set(id, hb);
    }

    hb.group.position.set(x, y, z);
    hb.group.quaternion.copy(this.camera.quaternion);
    hb.fill.scale.x = Math.max(0.001, pct);
  }

  public syncState(state: BattleState) {
    this.latestState = state;
    if (state.mapId && state.mapId !== this.currentMapId) {
      this.setMap(state.mapId);
    }
    this.syncNeutralObjectives(state.neutralObjectives || []);
    this.rebuildSpawnCircles(state);

    // Prune any dead units from selection
    let selectionChanged = false;
    const livingFriendlyIds = new Set(
      state.units.filter((u) => u.faction === this.playerFaction && u.state !== 'ko').map((u) => u.id)
    );
    for (const selId of this.selectedUnitIds) {
      if (!livingFriendlyIds.has(selId)) {
        this.selectedUnitIds.delete(selId);
        selectionChanged = true;
      }
    }
    if (selectionChanged) {
      this.callbacks.onSelectionChange?.(Array.from(this.selectedUnitIds));
    }

    const activeHealthBarIds = new Set<string>();

    // 1. Sync Buildings & Barracks Rally Flags
    const currentBuildingIds = new Set<string>();
    while (this.rallyFlagsGroup.children.length > 0) {
      this.rallyFlagsGroup.remove(this.rallyFlagsGroup.children[0]);
    }

    for (const b of state.buildings) {
      currentBuildingIds.add(b.id);
      let mesh = this.buildingMeshes.get(b.id);

      if (!mesh) {
        if (b.type === 'capital') mesh = createCapitalMesh(b.faction);
        else if (b.type === 'barracks') mesh = createBarracksMesh(b.faction, b.level);
        else if (b.type === 'refinery') mesh = createRefineryMesh(b.faction, b.level);
        else if (b.type === 'cannon_tower') mesh = createCannonTowerMesh(b.faction, b.level);
        else mesh = createArcSpireMesh(b.faction, b.level);

        const def = BUILDING_DEFS[b.type];
        mesh.position.set(b.gridX + def.width / 2, 0, b.gridZ + def.height / 2);
        mesh.userData = {
          gridX: b.gridX,
          gridZ: b.gridZ,
          width: def.width,
          height: def.height,
          level: b.level,
        };
        this.scene.add(mesh);
        this.buildingMeshes.set(b.id, mesh);
      } else {
        if (mesh.userData.level !== b.level) {
          this.scene.remove(mesh);
          let newMesh: THREE.Group;
          if (b.type === 'barracks') newMesh = createBarracksMesh(b.faction, b.level);
          else if (b.type === 'refinery') newMesh = createRefineryMesh(b.faction, b.level);
          else if (b.type === 'cannon_tower') newMesh = createCannonTowerMesh(b.faction, b.level);
          else if (b.type === 'arc_spire') newMesh = createArcSpireMesh(b.faction, b.level);
          else newMesh = createCapitalMesh(b.faction);

          const def = BUILDING_DEFS[b.type];
          newMesh.position.set(b.gridX + def.width / 2, 0, b.gridZ + def.height / 2);
          newMesh.userData = {
            gridX: b.gridX,
            gridZ: b.gridZ,
            width: def.width,
            height: def.height,
            level: b.level,
          };
          this.scene.add(newMesh);
          this.buildingMeshes.set(b.id, newMesh);
          mesh = newMesh;
        }

        const crystal = mesh.getObjectByName('floatingCrystal');
        if (crystal) {
          crystal.rotation.y += 0.035;
        }

        const wheel = mesh.getObjectByName('waterwheel');
        if (wheel) {
          wheel.rotation.z -= 0.04;
        }
      }

      // Render Rally Point Ring for player's Barracks
      if (
        b.type === 'barracks' &&
        b.faction === this.playerFaction &&
        typeof b.rallyX === 'number' &&
        typeof b.rallyZ === 'number'
      ) {
        const rallyRingGeo = new THREE.RingGeometry(0.95, 1.12, 24);
        rallyRingGeo.rotateX(-Math.PI / 2);
        const rallyRingMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const rallyRing = new THREE.Mesh(rallyRingGeo, rallyRingMat);
        rallyRing.position.set(b.rallyX, 0.035, b.rallyZ);
        this.rallyFlagsGroup.add(rallyRing);
      }

      if (b.hp < b.maxHp || b.type === 'capital') {
        const def = BUILDING_DEFS[b.type];
        activeHealthBarIds.add(b.id);
        this.updateOrCreateHealthBar(
          b.id,
          b.faction,
          b.gridX + def.width / 2,
          b.type === 'capital' ? 3.5 : 1.75,
          b.gridZ + def.height / 2,
          b.hp,
          b.maxHp,
          b.type === 'capital' ? 1.45 : 0.85
        );
      }
    }

    for (const [id, mesh] of this.buildingMeshes.entries()) {
      if (!currentBuildingIds.has(id)) {
        this.scene.remove(mesh);
        this.buildingMeshes.delete(id);
      }
    }

    // 2. Sync Units & Selected Unit Target Lines
    const currentUnitIds = new Set<string>();
    while (this.unitTargetLinesGroup.children.length > 0) {
      const child = this.unitTargetLinesGroup.children[0] as THREE.Line;
      this.unitTargetLinesGroup.remove(child);
      child.geometry.dispose();
    }

    for (const u of state.units) {
      currentUnitIds.add(u.id);
      let mesh = this.unitMeshes.get(u.id);

      if (!mesh) {
        mesh = createUnitMesh(u.faction, u.type, u.level);
        mesh.userData = {
          faction: u.faction,
          type: u.type,
          level: u.level,
          prevX: u.x,
          prevZ: u.z,
        };
        this.scene.add(mesh);
        this.unitMeshes.set(u.id, mesh);
      }

      // Toggle RTS selection ring visibility
      const isSelected = this.selectedUnitIds.has(u.id);
      const selRing = mesh.getObjectByName('selectionRing');
      if (selRing) {
        selRing.visible = isSelected;
      }

      // Draw movement vector line if unit is selected and moving to a targetPos
      if (isSelected && u.targetPos && u.state !== 'ko') {
        const pts = [
          new THREE.Vector3(u.x, 0.06, u.z),
          new THREE.Vector3(u.targetPos.x, 0.06, u.targetPos.z),
        ];
        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const lineMat = new THREE.LineBasicMaterial({
          color: 0x4ade80,
          transparent: true,
          opacity: 0.7,
        });
        this.unitTargetLinesGroup.add(new THREE.Line(lineGeo, lineMat));
      }

      // Compute smooth facing angle
      const dx = u.x - (mesh.userData.prevX ?? u.x);
      const dz = u.z - (mesh.userData.prevZ ?? u.z);
      if (Math.hypot(dx, dz) > 0.004) {
        mesh.rotation.y = Math.atan2(dx, dz);
      } else if (u.state === 'idle') {
        // Face toward opponent side while waiting at rally point
        mesh.rotation.y = u.faction === 'royal' ? Math.PI / 2 : -Math.PI / 2;
      }

      mesh.userData.prevX = u.x;
      mesh.userData.prevZ = u.z;
      mesh.position.x = u.x;
      mesh.position.z = u.z;

      if (u.state === 'moving' || u.state === 'marching') {
        mesh.rotation.x = 0;
        mesh.position.y = Math.abs(Math.sin(Date.now() * 0.012)) * 0.08;
      } else if (u.state === 'attacking') {
        mesh.rotation.x = 0;
        mesh.position.y = 0;
        mesh.rotation.y += Math.sin(Date.now() * 0.022) * 0.22;
      } else if (u.state === 'idle') {
        // Subtle breathing idle animation while waiting at Barracks / target position
        mesh.rotation.x = 0;
        mesh.position.y = Math.sin(Date.now() * 0.004 + u.x) * 0.015;
      } else {
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 0.05;
      }

      if (u.state !== 'ko') {
        activeHealthBarIds.add(u.id);
        this.updateOrCreateHealthBar(
          u.id,
          u.faction,
          u.x,
          u.type === 'siege' ? 1.15 : 1.0,
          u.z,
          u.hp,
          u.maxHp,
          0.62
        );
      }
    }

    for (const [id, mesh] of this.unitMeshes.entries()) {
      if (!currentUnitIds.has(id)) {
        this.scene.remove(mesh);
        this.unitMeshes.delete(id);
      }
    }

    for (const [id, hb] of this.healthBars.entries()) {
      if (!activeHealthBarIds.has(id)) {
        this.scene.remove(hb.group);
        this.healthBars.delete(id);
      }
    }

    // 3. Sync Projectiles
    const currentProjIds = new Set<string>();

    for (const p of state.projectiles) {
      currentProjIds.add(p.id);
      let mesh = this.projectileMeshes.get(p.id);

      if (!mesh) {
        const geo =
          p.kind === 'cannon'
            ? new THREE.SphereGeometry(0.14, 8, 8)
            : new THREE.SphereGeometry(0.11, 6, 6);
        const projColor =
          p.kind === 'cannon'
            ? 0x1e293b
            : p.faction === 'royal'
            ? 0x2563eb
            : 0xdc2626;
        const mat = new THREE.MeshBasicMaterial({ color: projColor });
        mesh = new THREE.Mesh(geo, mat);
        this.scene.add(mesh);
        this.projectileMeshes.set(p.id, mesh);
      }

      const curX = THREE.MathUtils.lerp(p.sourceX, p.targetX, p.progress);
      const curZ = THREE.MathUtils.lerp(p.sourceZ, p.targetZ, p.progress);
      let curY = THREE.MathUtils.lerp(p.sourceY, p.targetY, p.progress);
      if (p.kind === 'cannon') {
        curY += Math.sin(p.progress * Math.PI) * 1.5;
      }
      mesh.position.set(curX, curY, curZ);
    }

    for (const [id, mesh] of this.projectileMeshes.entries()) {
      if (!currentProjIds.has(id)) {
        this.scene.remove(mesh);
        this.projectileMeshes.delete(id);
      }
    }

    // Update placement ghost & radial cursor tint
    if (this.ghostMesh && this.hoveredTile && this.hoveredWorldPoint && this.placementSelection) {
      let legal = true;

      if (this.placementSelection.kind === 'building') {
        const def = BUILDING_DEFS[this.placementSelection.type];
        for (let dx = 0; dx < def.width; dx++) {
          for (let dz = 0; dz < def.height; dz++) {
            const tx = this.hoveredTile.x + dx;
            const tz = this.hoveredTile.z + dz;
            if (
              !isTileInFactionTerritory(this.playerFaction, tx, tz) ||
              isTileBlockedByBridge(tx, tz, state.mapId)
            ) {
              legal = false;
            }
          }
        }
        if (
          legal &&
          isTileOccupied(
            state.buildings,
            this.hoveredTile.x,
            this.hoveredTile.z,
            def.width,
            def.height
          )
        ) {
          legal = false;
        }
      } else {
        const check = canSpawnUnitAtPosition(
          state,
          this.playerFaction,
          this.hoveredWorldPoint.x,
          this.hoveredWorldPoint.z
        );
        legal = check.ok;
      }

      const tint = legal ? 0x10b981 : 0xef4444;
      this.ghostMesh.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(tint);
        }
      });
      this.unitCursorRing.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(tint);
        }
      });
    }

    // 4. Sync Floating Texts
    const currentTextIds = new Set<string>();
    for (const ft of state.floatingTexts) {
      currentTextIds.add(ft.id);
      let sprite = this.textSprites.get(ft.id);
      if (!sprite) {
        sprite = this.createTextSprite(ft.text, ft.color);
        this.scene.add(sprite);
        this.textSprites.set(ft.id, sprite);
      }
      const progress = ft.lifetime / ft.maxLifetime;
      sprite.position.set(ft.x, 1.3 + progress * 0.9, ft.z);
      sprite.material.opacity = Math.max(0, 1 - progress * 0.8);
    }

    for (const [id, sprite] of this.textSprites.entries()) {
      if (!currentTextIds.has(id)) {
        this.scene.remove(sprite);
        sprite.material.dispose();
        if (sprite.material.map) sprite.material.map.dispose();
        this.textSprites.delete(id);
      }
    }
  }

  private createTextSprite(text: string, color: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 54;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 6;
      ctx.strokeText(text, 120, 27);
      ctx.fillStyle = color === '#3b82f6' ? '#60a5fa' : color;
      ctx.fillText(text, 120, 27);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.0, 0.46, 1);
    return sprite;
  }

  private tick() {
    this.currentLookAt.x = THREE.MathUtils.damp(this.currentLookAt.x, this.targetLookAt.x, 8.5, 0.016);
    this.currentLookAt.y = THREE.MathUtils.damp(this.currentLookAt.y, this.targetLookAt.y, 8.5, 0.016);
    this.currentLookAt.z = THREE.MathUtils.damp(this.currentLookAt.z, this.targetLookAt.z, 8.5, 0.016);

    this.currentAzimuth = THREE.MathUtils.damp(this.currentAzimuth, this.targetAzimuth, 8.5, 0.016);
    this.currentPolar = THREE.MathUtils.damp(this.currentPolar, this.targetPolar, 8.5, 0.016);
    this.currentDistance = THREE.MathUtils.damp(this.currentDistance, this.targetDistance, 8.5, 0.016);

    this.updateCameraFromSpherical();

    if (this.riverTexture) {
      this.riverTexture.offset.y -= 0.0025;
    }

    // Animate RTS Move Order Marker
    if (this.moveMarkerGroup.visible) {
      this.moveMarkerTimer -= 0.016;
      if (this.moveMarkerTimer <= 0) {
        this.moveMarkerGroup.visible = false;
      } else {
        const ptr = this.moveMarkerGroup.getObjectByName('movePointer');
        if (ptr) {
          ptr.position.y = 0.45 + Math.abs(Math.sin(Date.now() * 0.012)) * 0.25;
          ptr.rotation.y += 0.06;
        }
        const ring = this.moveMarkerGroup.getObjectByName('moveOuterRing');
        if (ring) {
          const s = 0.8 + ((1.6 - this.moveMarkerTimer) % 0.6) * 0.7;
          ring.scale.set(s, s, 1);
        }
      }
    }

    // Animate Neutral Forest Shrines
    for (const group of this.neutralObjectiveMeshes.values()) {
      const crystal = group.getObjectByName('coreCrystal');
      if (crystal) {
        crystal.rotation.y += 0.025;
        crystal.position.y = 1.28 + Math.sin(Date.now() * 0.003) * 0.08;
      }
    }

    if (this.selectedTileMesh.visible) {
      const pulse = 1 + Math.sin(Date.now() * 0.008) * 0.06;
      this.selectedTileMesh.scale.set(pulse, 1, pulse);
    }

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.animFrameId = window.setTimeout(poll, 6);
        } else {
          if (sync) gl.deleteSync(sync);
          this.animFrameId = window.setTimeout(this.tick, 60);
        }
      };
      this.animFrameId = window.setTimeout(poll, 6);
    } else {
      this.animFrameId = requestAnimationFrame(this.tick);
    }
  }

  public dispose() {
    cancelAnimationFrame(this.animFrameId);
    clearTimeout(this.animFrameId);
    this.renderer.dispose();
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
