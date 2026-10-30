/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  BattleState,
  BuildingState,
  BuildingType,
  BUILDING_DEFS,
  Faction,
  PlacementSelection,
  UNIT_DEFS,
  UnitType,
} from '../game/types';
import {
  Pickaxe,
  Crosshair,
  Zap,
  Sword,
  Target,
  Truck,
  ArrowUpCircle,
  Trash2,
  X,
  Tent,
  Users,
} from 'lucide-react';

interface BottomCommandDockProps {
  state: BattleState;
  playerFaction: Faction;
  selectedPlacement: PlacementSelection;
  onSelectPlacement: (selection: PlacementSelection) => void;
  selectedBuilding: BuildingState | null;
  onCloseInspector: () => void;
  onUpgradeBuilding: (buildingId: string) => void;
  onDemolishBuilding: (buildingId: string) => void;
  selectedUnitIds: string[];
  onClearUnitSelection: () => void;
  onSelectAllUnits: () => void;
  onSetBarracksUnitType: (buildingId: string, unitType: UnitType) => void;
}

export const BottomCommandDock: React.FC<BottomCommandDockProps> = ({
  state,
  playerFaction,
  selectedPlacement,
  onSelectPlacement,
  selectedBuilding,
  onCloseInspector,
  onUpgradeBuilding,
  onDemolishBuilding,
  selectedUnitIds,
  onClearUnitSelection,
  onSelectAllUnits,
  onSetBarracksUnitType,
}) => {
  const player = state.players[playerFaction];
  const gold = Math.floor(player.gold);
  const isRoyal = playerFaction === 'royal';

  const friendlyUnits = state.units.filter(
    (u) => u.faction === playerFaction && u.state !== 'ko'
  );

  const isUnitSelected = (uType: UnitType) =>
    selectedPlacement?.kind === 'unit' && selectedPlacement.type === uType;

  const isBuildingSelected = (bType: BuildingType) =>
    selectedPlacement?.kind === 'building' && selectedPlacement.type === bType;

  const activeAccent = isRoyal
    ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-400 shadow-md -translate-y-0.5'
    : 'bg-red-600 text-white border-red-700 ring-2 ring-red-400 shadow-md -translate-y-0.5';

  const troopItems: Array<{
    type: UnitType;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
  }> = [
    { type: 'melee', label: 'Knight', Icon: Sword },
    { type: 'ranged', label: 'Archer', Icon: Target },
    { type: 'siege', label: 'Ram', Icon: Truck },
  ];

  const buildingItems: Array<{
    type: BuildingType;
    label: string;
    cost: number;
    Icon: React.ComponentType<{ className?: string }>;
  }> = [
    { type: 'barracks', label: 'Camp', cost: 90, Icon: Tent },
    { type: 'refinery', label: 'Mill', cost: 75, Icon: Pickaxe },
    { type: 'cannon_tower', label: 'Cannon', cost: 100, Icon: Crosshair },
    { type: 'arc_spire', label: 'Spire', cost: 130, Icon: Zap },
  ];

  const soldiersSelected = selectedUnitIds.length > 0;

  return (
    <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-2 pointer-events-none">
      {/* Compact Building Upgrade Bar (only shown when tapping an existing friendly building) */}
      {!selectedPlacement &&
        !soldiersSelected &&
        selectedBuilding &&
        selectedBuilding.faction === playerFaction &&
        selectedBuilding.type !== 'capital' && (
          <div className="pointer-events-auto mb-1.5 mx-auto flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-white/95 text-slate-900 text-xs font-bold shadow-lg border border-slate-200">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="truncate font-extrabold">
                {BUILDING_DEFS[selectedBuilding.type].name[playerFaction]}
              </span>
              <span className="text-[11px] font-mono text-slate-500 shrink-0">
                Lv.{selectedBuilding.level}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {selectedBuilding.type === 'barracks' && (
                <div className="flex items-center gap-1 mr-1">
                  {(['melee', 'ranged', 'siege'] as UnitType[]).map((uType) => {
                    const active = (selectedBuilding.producingUnitType || 'melee') === uType;
                    return (
                      <button
                        key={uType}
                        onClick={() => onSetBarracksUnitType(selectedBuilding.id, uType)}
                        className={`px-2 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${
                          active
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {uType === 'melee' ? 'Knight' : uType === 'ranged' ? 'Archer' : 'Ram'}
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedBuilding.level < 3 && (
                <button
                  onClick={() => onUpgradeBuilding(selectedBuilding.id)}
                  disabled={gold < BUILDING_DEFS[selectedBuilding.type].cost[selectedBuilding.level]}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[11px] font-bold cursor-pointer whitespace-nowrap"
                >
                  <ArrowUpCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{BUILDING_DEFS[selectedBuilding.type].cost[selectedBuilding.level]}g</span>
                </button>
              )}

              <button
                onClick={() => onDemolishBuilding(selectedBuilding.id)}
                className="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 cursor-pointer"
                aria-label="Demolish"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                onClick={onCloseInspector}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      {/* Unified Mobile Action Dock (Grid of 8 clean buttons, zero tutorial text) */}
      <div className="pointer-events-auto rounded-2xl bg-white/95 border border-slate-200 p-1.5 shadow-xl grid grid-cols-8 gap-1">
        {/* 1. Select Soldiers */}
        <button
          onClick={() => {
            if (soldiersSelected) {
              onClearUnitSelection();
            } else {
              onSelectAllUnits();
            }
          }}
          disabled={friendlyUnits.length === 0}
          className={`flex flex-col items-center justify-center h-14 sm:h-15 rounded-xl border transition-all cursor-pointer ${
            soldiersSelected
              ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-400 shadow-md -translate-y-0.5'
              : friendlyUnits.length > 0
              ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-900'
              : 'bg-slate-50 border-slate-200 text-slate-400 opacity-50'
          }`}
        >
          <Users className="w-4 h-4 mb-0.5 shrink-0" />
          <span className="text-[10px] sm:text-[11px] font-extrabold leading-none">
            Army
          </span>
          <span className="text-[9px] sm:text-[10px] font-mono font-black tabular-nums leading-tight mt-0.5">
            {soldiersSelected ? `${selectedUnitIds.length}` : `${friendlyUnits.length}`}
          </span>
        </button>

        {/* 2-4. Troops: Knight, Archer, Ram */}
        {troopItems.map(({ type, label, Icon }) => {
          const tier = player.troopTiers[type];
          const cost = UNIT_DEFS[type].cost[tier - 1];
          const selected = isUnitSelected(type);
          const affordable = gold >= cost;

          return (
            <button
              key={type}
              onClick={() =>
                onSelectPlacement(selected ? null : { kind: 'unit', type })
              }
              className={`flex flex-col items-center justify-center h-14 sm:h-15 rounded-xl border transition-all cursor-pointer ${
                selected
                  ? activeAccent
                  : affordable
                  ? 'bg-slate-50 hover:bg-slate-100 active:scale-95 border-slate-200 text-slate-900'
                  : 'bg-slate-50 border-slate-200 text-slate-400 opacity-55'
              }`}
            >
              <Icon
                className={`w-4 h-4 mb-0.5 shrink-0 ${
                  selected ? 'text-white' : isRoyal ? 'text-blue-600' : 'text-red-600'
                }`}
              />
              <span className="text-[10px] sm:text-[11px] font-extrabold leading-none">
                {label}
              </span>
              <span className="text-[9px] sm:text-[10px] font-mono font-black tabular-nums leading-tight mt-0.5">
                {cost}g
              </span>
            </button>
          );
        })}

        {/* 5-8. Buildings: Camp, Mill, Cannon, Spire */}
        {buildingItems.map(({ type, label, cost, Icon }) => {
          const selected = isBuildingSelected(type);
          const affordable = gold >= cost;

          return (
            <button
              key={type}
              onClick={() =>
                onSelectPlacement(selected ? null : { kind: 'building', type })
              }
              className={`flex flex-col items-center justify-center h-14 sm:h-15 rounded-xl border transition-all cursor-pointer ${
                selected
                  ? activeAccent
                  : affordable
                  ? 'bg-slate-50 hover:bg-slate-100 active:scale-95 border-slate-200 text-slate-900'
                  : 'bg-slate-50 border-slate-200 text-slate-400 opacity-55'
              }`}
            >
              <Icon
                className={`w-4 h-4 mb-0.5 shrink-0 ${
                  selected
                    ? 'text-white'
                    : type === 'refinery'
                    ? 'text-amber-600'
                    : isRoyal
                    ? 'text-blue-600'
                    : 'text-red-600'
                }`}
              />
              <span className="text-[10px] sm:text-[11px] font-extrabold leading-none">
                {label}
              </span>
              <span className="text-[9px] sm:text-[10px] font-mono font-black tabular-nums leading-tight mt-0.5">
                {cost}g
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
