/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BattleState, Faction } from '../game/types';
import {
  Shield,
  Flame,
  Volume2,
  VolumeX,
  QrCode,
  Compass,
} from 'lucide-react';

interface TopPerimeterHUDProps {
  state: BattleState;
  playerFaction: Faction;
  isMuted: boolean;
  onToggleMute: () => void;
  onResetCamera: () => void;
  onOpenQR?: () => void;
}

export const TopPerimeterHUD: React.FC<TopPerimeterHUDProps> = ({
  state,
  playerFaction,
  isMuted,
  onToggleMute,
  onResetCamera,
  onOpenQR,
}) => {
  const royalCap = state.buildings.find((b) => b.id === 'cap_royal');
  const infernalCap = state.buildings.find((b) => b.id === 'cap_infernal');

  const royalHp = royalCap ? Math.round(royalCap.hp) : 0;
  const royalMaxHp = royalCap ? royalCap.maxHp : 2500;
  const royalHpPct = Math.max(0, Math.min(100, (royalHp / royalMaxHp) * 100));

  const infernalHp = infernalCap ? Math.round(infernalCap.hp) : 0;
  const infernalMaxHp = infernalCap ? infernalCap.maxHp : 2500;
  const infernalHpPct = Math.max(0, Math.min(100, (infernalHp / infernalMaxHp) * 100));

  const player = state.players[playerFaction];
  const gold = Math.floor(player.gold);

  const minutes = Math.floor(state.elapsedTime / 60);
  const seconds = Math.floor(state.elapsedTime % 60);
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <header className="fixed top-0 left-0 right-0 z-20 pointer-events-none p-2 sm:p-3">
      <div className="flex items-center justify-between w-full max-w-4xl mx-auto gap-1.5 sm:gap-3">
        {/* Blue Castle Health */}
        <div className="flex-1 max-w-[125px] sm:max-w-[200px] flex flex-col pointer-events-auto bg-white/95 border border-blue-200 rounded-xl px-2.5 py-1.5 shadow-md">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-extrabold text-blue-700 mb-1 whitespace-nowrap">
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Blue</span>
            </span>
            <span className="font-mono text-xs sm:text-sm text-slate-900 font-black tabular-nums">
              {royalHp}
            </span>
          </div>
          <div className="h-2 w-full bg-blue-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${royalHpPct}%` }}
            />
          </div>
        </div>

        {/* Center Gold & Clock */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 border border-amber-500 shadow-md text-slate-950">
            <span className="w-4 h-4 rounded-full bg-amber-950 text-amber-300 flex items-center justify-center text-[10px] font-black shrink-0">
              G
            </span>
            <span className="font-mono text-sm sm:text-base font-black tabular-nums leading-none">
              {gold}
            </span>
          </div>

          <div className="hidden xs:flex px-2.5 py-1.5 rounded-xl bg-white/95 border border-slate-200 shadow-md items-center">
            <span className="font-mono text-xs sm:text-sm font-bold text-slate-700 tabular-nums leading-none">
              {timeFormatted}
            </span>
          </div>
        </div>

        {/* Red Castle Health + Compact Action Buttons */}
        <div className="flex items-center gap-1.5 flex-1 justify-end max-w-[180px] sm:max-w-[260px]">
          <div className="flex-1 flex flex-col pointer-events-auto items-end bg-white/95 border border-red-200 rounded-xl px-2.5 py-1.5 shadow-md min-w-[88px]">
            <div className="flex items-center justify-between w-full text-[11px] sm:text-xs font-extrabold text-red-700 mb-1 whitespace-nowrap">
              <span className="font-mono text-xs sm:text-sm text-slate-900 font-black tabular-nums">
                {infernalHp}
              </span>
              <span className="flex items-center gap-1">
                <span>Red</span>
                <Flame className="w-3.5 h-3.5 text-red-600 shrink-0" />
              </span>
            </div>
            <div className="h-2 w-full bg-red-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-600 rounded-full transition-all duration-300 ml-auto"
                style={{ width: `${infernalHpPct}%` }}
              />
            </div>
          </div>

          {/* Reset Camera View Button (40x40 mobile hitbox) */}
          <button
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onResetCamera();
            }}
            aria-label="Center Map"
            title="Center Map"
            className="pointer-events-auto w-10 h-10 rounded-xl bg-white/95 hover:bg-slate-100 active:scale-95 border border-slate-200 text-slate-700 flex items-center justify-center shadow-md transition-transform cursor-pointer shrink-0"
          >
            <Compass className="w-4 h-4 text-blue-600" />
          </button>

          {onOpenQR && state.mode === 'multiplayer' && (
            <button
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenQR();
              }}
              aria-label="Room QR Code"
              title="Room QR Code"
              className="pointer-events-auto w-10 h-10 rounded-xl bg-white/95 hover:bg-slate-100 active:scale-95 border border-slate-200 text-slate-700 flex items-center justify-center shadow-md transition-transform cursor-pointer shrink-0"
            >
              <QrCode className="w-4 h-4 text-blue-600" />
            </button>
          )}

          {/* Mute Toggle Button (40x40 mobile hitbox) */}
          <button
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            title={isMuted ? 'Unmute' : 'Mute'}
            className="pointer-events-auto w-10 h-10 rounded-xl bg-white/95 hover:bg-slate-100 active:scale-95 border border-slate-200 text-slate-700 flex items-center justify-center shadow-md transition-transform cursor-pointer shrink-0"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-red-600" />
            ) : (
              <Volume2 className="w-4 h-4 text-slate-700" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
