/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BattleState, Faction } from '../game/types';
import { Trophy, Skull, RotateCcw, Home, Clock, Coins, Shield, Swords } from 'lucide-react';

interface VictoryModalProps {
  state: BattleState;
  playerFaction: Faction;
  onRematch: () => void;
  onTitle: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  state,
  playerFaction,
  onRematch,
  onTitle,
}) => {
  const isWinner = state.winner === playerFaction;
  const player = state.players[playerFaction];

  const minutes = Math.floor(state.elapsedTime / 60);
  const seconds = Math.floor(state.elapsedTime % 60);
  const timeFormatted = `${minutes}m ${seconds}s`;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/45 pointer-events-auto">
      <div className="relative w-full max-w-md rounded-3xl bg-white border border-slate-200 p-6 text-center shadow-2xl text-slate-900">
        {/* Outcome Emblem */}
        <div className="mx-auto w-16 h-16 rounded-2xl mb-4 flex items-center justify-center">
          {isWinner ? (
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border-2 border-blue-200 flex items-center justify-center text-blue-600 shadow-sm">
              <Trophy className="w-9 h-9" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-red-50 border-2 border-red-200 flex items-center justify-center text-red-600 shadow-sm">
              <Skull className="w-9 h-9" />
            </div>
          )}
        </div>

        {/* Title */}
        <h2
          className={`font-['Cinzel'] font-black text-3xl sm:text-4xl tracking-tight mb-1 ${
            isWinner ? 'text-blue-600' : 'text-red-600'
          }`}
        >
          {isWinner ? 'VICTORY ACHIEVED' : 'CITADEL FALLEN'}
        </h2>
        <p className="text-xs text-slate-500 font-medium mb-6">
          {isWinner
            ? 'The rival stronghold has been toppled! Glory to your banner.'
            : 'Your capital citadel was overwhelmed by enemy siege forces.'}
        </p>

        {/* Mastery KPI Stats Grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-6 text-left">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-400 mb-0.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Duration</span>
            </div>
            <div className="font-mono text-base font-black text-slate-900 tabular-nums">
              {timeFormatted}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-amber-700 mb-0.5">
              <Coins className="w-3.5 h-3.5 text-amber-600" />
              <span>Gold Harvested</span>
            </div>
            <div className="font-mono text-base font-black text-amber-900 tabular-nums">
              {Math.floor(player.totalGoldEarned)}g
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200">
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-blue-700 mb-0.5">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              <span>Structures Built</span>
            </div>
            <div className="font-mono text-base font-black text-slate-900 tabular-nums">
              {player.buildingsConstructed}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-red-50/60 border border-red-200">
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-red-700 mb-0.5">
              <Swords className="w-3.5 h-3.5 text-red-600" />
              <span>Units Deployed</span>
            </div>
            <div className="font-mono text-base font-black text-slate-900 tabular-nums">
              {player.unitsDeployed}
            </div>
          </div>
        </div>

        {/* Modal CTAs */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            data-start="true"
            onClick={onRematch}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider shadow-md transition-transform active:scale-[0.98] cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Again</span>
          </button>

          <button
            onClick={onTitle}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold border border-slate-300 transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
