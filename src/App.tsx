/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  BattleState,
  BuildingType,
  Faction,
  MapId,
  PlacementSelection,
  UnitType,
} from './game/types';
import {
  createInitialGameState,
  placeBuilding,
  upgradeBuilding,
  demolishBuilding,
  deployUnit,
  stepBattleSimulation,
  stepBotAI,
  isTileInFactionTerritory,
  canSpawnUnitAtPosition,
  getValidSpawnCircles,
  findNearestLaneAndWaypoint,
  commandUnitsMove,
  setBarracksConfig,
} from './game/rules';
import { ThreeSceneManager, SelectionBoxRect } from './game/view3d/ThreeScene';
import { sound } from './game/audio';
import { TitleScreen } from './components/TitleScreen';
import { TopPerimeterHUD } from './components/TopPerimeterHUD';
import { BottomCommandDock } from './components/BottomCommandDock';
import { QRModal } from './components/QRModal';
import { VictoryModal } from './components/VictoryModal';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneManagerRef = useRef<ThreeSceneManager | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [appState, setAppState] = useState<'title' | 'playing' | 'paused' | 'gameover'>('title');
  const [selectedMapId, setSelectedMapId] = useState<MapId>('ironhold_chasm');
  const [battleState, setBattleState] = useState<BattleState>(() =>
    createInitialGameState('LOCAL', 'ai', 'ironhold_chasm')
  );
  const [playerFaction, setPlayerFaction] = useState<Faction>('royal');
  const [selectedPlacement, setSelectedPlacement] = useState<PlacementSelection>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [selectBoxRect, setSelectBoxRect] = useState<SelectionBoxRect | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 1800);
  }, []);

  const handleResetCamera = useCallback(() => {
    sceneManagerRef.current?.resetNorth();
    sceneManagerRef.current?.snapCameraFull();
  }, []);

  const handleTileClickRef = useRef<(gx: number, gz: number, wx: number, wz: number) => void>(() => {});
  const handleMoveUnitsRef = useRef<(unitIds: string[], wx: number, wz: number) => void>(() => {});

  useEffect(() => {
    document.body.dataset.state = appState;
  }, [appState]);

  // Initialize Three.js Scene once
  useEffect(() => {
    if (!mountRef.current) return;

    const manager = new ThreeSceneManager(mountRef.current, {
      onTileClick: (gx, gz, wx, wz) => {
        handleTileClickRef.current(gx, gz, wx, wz);
      },
      onBuildingClick: (id) => {
        if (id) {
          setSelectedBuildingId(id);
          setSelectedPlacement(null);
          manager.setPlacementSelection(null);
        } else {
          setSelectedBuildingId(null);
        }
      },
      onTileHover: () => {},
      onSelectionChange: (unitIds) => {
        setSelectedUnitIds(unitIds);
        if (unitIds.length > 0) {
          setSelectedPlacement(null);
          setSelectedBuildingId(null);
        }
      },
      onMoveUnitsCommand: (unitIds, wx, wz) => {
        handleMoveUnitsRef.current(unitIds, wx, wz);
      },
      onSelectBoxUpdate: (box) => {
        setSelectBoxRect(box);
      },
    });

    sceneManagerRef.current = manager;

    return () => {
      manager.dispose();
      sceneManagerRef.current = null;
    };
  }, []);

  // Sync placement selection to 3D scene
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setPlacementSelection(selectedPlacement);
      sceneManagerRef.current.setShowSpawnRings(Boolean(selectedPlacement));
    }
  }, [selectedPlacement]);

  // Sync faction to 3D scene
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setPlayerFaction(playerFaction);
    }
  }, [playerFaction]);

  // Sync state to 3D scene
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.syncState(battleState);
    }

    if (battleState.status === 'gameover' && appState === 'playing') {
      setAppState('gameover');
      if (battleState.winner === playerFaction) {
        sound.playVictory();
      } else {
        sound.playDefeat();
      }
    }
  }, [battleState, appState, playerFaction]);

  // Local AI Loop
  useEffect(() => {
    if (appState !== 'playing' || battleState.mode !== 'ai') return;

    let lastTime = performance.now();
    const interval = setInterval(() => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      setBattleState((prev) => {
        if (prev.status !== 'playing') return prev;
        const next = { ...prev };
        stepBattleSimulation(next, dt);
        stepBotAI(next, dt);
        return { ...next };
      });
    }, 50);

    return () => clearInterval(interval);
  }, [appState, battleState.mode]);

  // Multiplayer WebSocket
  const connectWebSocket = useCallback(
    (action: { type: 'create' | 'join'; roomId?: string }) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (action.type === 'create') {
          ws.send(JSON.stringify({ type: 'room:create', mode: 'multiplayer', mapId: selectedMapId }));
        } else {
          ws.send(JSON.stringify({ type: 'room:join', roomId: action.roomId }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'room:joined') {
            setPlayerFaction(msg.faction);
            setBattleState(msg.state);
            if (msg.state.mapId) {
              setSelectedMapId(msg.state.mapId);
              sceneManagerRef.current?.setMap(msg.state.mapId);
            }
            setAppState('playing');
            if (msg.faction === 'royal') {
              setShowQRModal(true);
            } else {
              sound.playCoin();
            }
            if (sceneManagerRef.current) {
              sceneManagerRef.current.setPlayerFaction(msg.faction);
              sceneManagerRef.current.snapCameraFull();
            }
          } else if (msg.type === 'player:connected') {
            setShowQRModal(false);
            sound.playBuild();
          } else if (msg.type === 'state:update') {
            setBattleState(msg.state);
          } else if (msg.type === 'event:built') {
            sound.playBuild();
          } else if (msg.type === 'event:deployed') {
            sound.playHit();
          } else if (msg.type === 'event:upgraded') {
            sound.playUpgrade();
          } else if (msg.type === 'action:rejected') {
            showToast(msg.reason || 'Cannot place there');
          } else if (msg.type === 'error') {
            showToast(msg.message || 'Connection error');
          }
        } catch (err) {
          console.error('WS parse error:', err);
        }
      };

      ws.onerror = () => {
        showToast('Connection error');
      };
    },
    [showToast, selectedMapId]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const autoParam = params.get('autostart');

    if (roomParam) {
      connectWebSocket({ type: 'join', roomId: roomParam });
    } else if (autoParam === '1') {
      handleStartAI();
    }
  }, [connectWebSocket]);

  // Rule #2: Move Selected Soldiers to clicked map position
  const handleMoveUnitsCommand = useCallback(
    (unitIds: string[], wx: number, wz: number) => {
      if (unitIds.length === 0) return;

      if (battleState.mode === 'ai') {
        const res = commandUnitsMove(battleState, playerFaction, unitIds, wx, wz);
        if (res.success) {
          sound.playHit();
          sceneManagerRef.current?.showMoveOrderMarker(wx, wz);
          setBattleState({ ...battleState });
        }
      } else {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          sound.playHit();
          sceneManagerRef.current?.showMoveOrderMarker(wx, wz);
          wsRef.current.send(
            JSON.stringify({
              type: 'action:move_units',
              unitIds,
              destX: wx,
              destZ: wz,
            })
          );
        }
      }
    },
    [battleState, playerFaction]
  );

  useEffect(() => {
    handleMoveUnitsRef.current = handleMoveUnitsCommand;
  }, [handleMoveUnitsCommand]);

  const handleSetBarracksUnitType = useCallback(
    (buildingId: string, unitType: UnitType) => {
      if (battleState.mode === 'ai') {
        const res = setBarracksConfig(battleState, playerFaction, buildingId, unitType);
        if (res.success) {
          sound.playCoin();
          setBattleState({ ...battleState });
        }
      } else {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'action:barracks_config',
              buildingId,
              producingUnitType: unitType,
            })
          );
        }
      }
    },
    [battleState, playerFaction]
  );

  // Rule #1: 2nd click on terrain places the selected Building or Troop
  const handleTileClick = useCallback(
    (gx: number, gz: number, wx: number, wz: number) => {
      if (!selectedPlacement) {
        setSelectedBuildingId(null);
        return;
      }

      if (selectedPlacement.kind === 'building') {
        if (battleState.mode === 'ai') {
          const res = placeBuilding(battleState, playerFaction, selectedPlacement.type, gx, gz);
          if (res.success) {
            sound.playBuild();
            setBattleState({ ...battleState });
          } else {
            showToast(res.reason || 'Cannot place here');
          }
        } else {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'action:build',
                buildingType: selectedPlacement.type,
                gridX: gx,
                gridZ: gz,
              })
            );
          }
        }
      } else if (selectedPlacement.kind === 'unit') {
        let targetX = wx;
        let targetZ = wz;

        const spawnCheck = canSpawnUnitAtPosition(battleState, playerFaction, targetX, targetZ);
        if (!spawnCheck.ok) {
          // If the user tapped inside their territory (or near their side), snap to nearest valid spawn circle so mobile taps are forgiving
          if (isTileInFactionTerritory(playerFaction, gx, gz)) {
            const circles = getValidSpawnCircles(battleState, playerFaction);
            if (circles.length > 0) {
              let bestCircle = circles[0];
              let bestDist = Infinity;
              for (const c of circles) {
                const d = Math.hypot(wx - c.x, wz - c.z);
                if (d < bestDist) {
                  bestDist = d;
                  bestCircle = c;
                }
              }
              const angle = Math.atan2(wz - bestCircle.z, wx - bestCircle.x);
              const clampedDist = Math.min(bestDist, bestCircle.radius - 0.15);
              targetX = bestCircle.x + Math.cos(angle) * clampedDist;
              targetZ = bestCircle.z + Math.sin(angle) * clampedDist;
            }
          } else {
            showToast('Tap on your side of the map to place troop');
            return;
          }
        }

        const { lane: determinedLane } = findNearestLaneAndWaypoint(
          battleState.mapId,
          playerFaction,
          targetX,
          targetZ
        );

        if (battleState.mode === 'ai') {
          const res = deployUnit(
            battleState,
            playerFaction,
            selectedPlacement.type,
            determinedLane,
            targetX,
            targetZ
          );
          if (res.success) {
            sound.playHit();
            setBattleState({ ...battleState });
          } else {
            showToast(res.reason || 'Not enough gold');
          }
        } else {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'action:deploy',
                unitType: selectedPlacement.type,
                lane: determinedLane,
                spawnX: targetX,
                spawnZ: targetZ,
              })
            );
          }
        }
      }
    },
    [battleState, playerFaction, selectedPlacement, showToast]
  );

  useEffect(() => {
    handleTileClickRef.current = handleTileClick;
  }, [handleTileClick]);

  // Building Upgrade & Sell
  const handleUpgradeBuilding = useCallback(
    (buildingId: string) => {
      if (battleState.mode === 'ai') {
        const res = upgradeBuilding(battleState, playerFaction, buildingId);
        if (res.success) {
          sound.playUpgrade();
          setBattleState({ ...battleState });
        } else {
          showToast(res.reason || 'Not enough gold');
        }
      } else {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'action:upgrade', buildingId }));
        }
      }
    },
    [battleState, playerFaction, showToast]
  );

  const handleDemolishBuilding = useCallback(
    (buildingId: string) => {
      if (battleState.mode === 'ai') {
        const res = demolishBuilding(battleState, playerFaction, buildingId);
        if (res.success) {
          sound.playCoin();
          setSelectedBuildingId(null);
          setBattleState({ ...battleState });
        }
      } else {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'action:demolish', buildingId }));
          setSelectedBuildingId(null);
        }
      }
    },
    [battleState, playerFaction]
  );

  const handleSelectAllUnits = useCallback(() => {
    setSelectedPlacement(null);
    setSelectedBuildingId(null);
    sceneManagerRef.current?.selectAllFriendlyUnits(false);
  }, []);

  const handleClearUnitSelection = useCallback(() => {
    sceneManagerRef.current?.clearUnitSelection();
  }, []);

  // Start Flows
  const handleStartAI = (mapToUse?: MapId) => {
    const chosenMap = mapToUse || selectedMapId;
    const newState = createInitialGameState('SOLO_AI', 'ai', chosenMap);
    setBattleState(newState);
    setPlayerFaction('royal');
    setAppState('playing');
    setSelectedPlacement(null);
    setSelectedBuildingId(null);
    setSelectedUnitIds([]);
    sound.playBuild();
    if (sceneManagerRef.current) {
      sceneManagerRef.current.clearUnitSelection();
      sceneManagerRef.current.setMap(chosenMap);
      sceneManagerRef.current.setPlayerFaction('royal');
      sceneManagerRef.current.snapCameraFull();
    }
  };

  const handleCreateMultiplayer = () => {
    connectWebSocket({ type: 'create' });
  };

  const handleJoinRoom = (code: string) => {
    connectWebSocket({ type: 'join', roomId: code });
  };

  const handleRematch = () => {
    if (battleState.mode === 'ai') {
      const chosenMap = battleState.mapId || selectedMapId;
      const newState = createInitialGameState('SOLO_AI', 'ai', chosenMap);
      setBattleState(newState);
      setAppState('playing');
      setSelectedPlacement(null);
      setSelectedBuildingId(null);
      setSelectedUnitIds([]);
      sound.playBuild();
      if (sceneManagerRef.current) {
        sceneManagerRef.current.clearUnitSelection();
        sceneManagerRef.current.setMap(chosenMap);
        sceneManagerRef.current.snapCameraFull();
      }
    } else {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'action:rematch' }));
      }
      setAppState('playing');
    }
  };

  const handleTitle = () => {
    setAppState('title');
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (sceneManagerRef.current) {
      sceneManagerRef.current.clearUnitSelection();
      sceneManagerRef.current.setMap(selectedMapId);
      sceneManagerRef.current.snapCameraFull();
    }
  };

  const toggleMute = () => {
    const m = sound.toggleMute();
    setIsMuted(m);
  };

  // Optional keyboard shortcuts for desktop convenience
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'Escape') {
        setSelectedPlacement(null);
        setSelectedBuildingId(null);
        sceneManagerRef.current?.clearUnitSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectedBuilding = selectedBuildingId
    ? battleState.buildings.find((b) => b.id === selectedBuildingId) || null
    : null;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#dbeafe] select-none font-sans text-slate-900 touch-none">
      {/* 3D WebGL Canvas Mount Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* 2D RTS Marquee Selection Box Overlay */}
      {selectBoxRect && (
        <div
          className="fixed z-10 pointer-events-none border-2 border-emerald-400 bg-emerald-400/15 rounded-xs"
          style={{
            left: `${selectBoxRect.x}px`,
            top: `${selectBoxRect.y}px`,
            width: `${selectBoxRect.w}px`,
            height: `${selectBoxRect.h}px`,
          }}
        />
      )}

      {/* Title Screen Overlay */}
      {appState === 'title' && (
        <TitleScreen
          selectedMap={selectedMapId}
          onSelectMap={(mapId) => {
            setSelectedMapId(mapId);
            sceneManagerRef.current?.setMap(mapId);
          }}
          onStartAI={() => handleStartAI(selectedMapId)}
          onCreateMultiplayer={handleCreateMultiplayer}
          onJoinRoom={handleJoinRoom}
        />
      )}

      {/* Active Battle HUD */}
      {appState === 'playing' && (
        <>
          <TopPerimeterHUD
            state={battleState}
            playerFaction={playerFaction}
            isMuted={isMuted}
            onToggleMute={toggleMute}
            onResetCamera={handleResetCamera}
            onOpenQR={() => setShowQRModal(true)}
          />

          <BottomCommandDock
            state={battleState}
            playerFaction={playerFaction}
            selectedPlacement={selectedPlacement}
            onSelectPlacement={(selection) => {
              setSelectedPlacement(selection);
              setSelectedBuildingId(null);
              sceneManagerRef.current?.clearUnitSelection();
            }}
            selectedBuilding={selectedBuilding}
            onCloseInspector={() => setSelectedBuildingId(null)}
            onUpgradeBuilding={handleUpgradeBuilding}
            onDemolishBuilding={handleDemolishBuilding}
            selectedUnitIds={selectedUnitIds}
            onClearUnitSelection={handleClearUnitSelection}
            onSelectAllUnits={handleSelectAllUnits}
            onSetBarracksUnitType={handleSetBarracksUnitType}
          />
        </>
      )}

      {/* QR Code Multiplayer Modal */}
      {showQRModal && (
        <QRModal
          roomId={battleState.roomId}
          opponentConnected={battleState.players.infernal.connected}
          onClose={() => setShowQRModal(false)}
          onStartNow={() => setShowQRModal(false)}
        />
      )}

      {/* Victory / Defeat Modal */}
      {appState === 'gameover' && (
        <VictoryModal
          state={battleState}
          playerFaction={playerFaction}
          onRematch={handleRematch}
          onTitle={handleTitle}
        />
      )}

      {/* Brief feedback toast (only when an action is invalid/blocked) */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-4 py-2 rounded-xl bg-slate-900/95 text-white text-xs font-bold shadow-lg">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
