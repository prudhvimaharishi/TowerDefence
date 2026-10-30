/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { QrCode, Bot, Users, ArrowRight } from 'lucide-react';
import { MapId, MAP_DEFS } from '../game/types';

interface TitleScreenProps {
  selectedMap: MapId;
  onSelectMap: (mapId: MapId) => void;
  onStartAI: () => void;
  onCreateMultiplayer: () => void;
  onJoinRoom: (code: string) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  selectedMap,
  onSelectMap,
  onStartAI,
  onCreateMultiplayer,
  onJoinRoom,
}) => {
  const [joinCode, setJoinCode] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onStartAI();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onStartAI]);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim().length >= 4) {
      onJoinRoom(joinCode.trim().toUpperCase());
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/35 text-slate-900 pointer-events-auto">
      <div className="flex flex-col items-center text-center max-w-md w-full px-6 py-6 rounded-3xl bg-white/95 border border-slate-200 shadow-2xl">
        <h1 className="font-['Cinzel'] text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
          CROWN & CINDER
        </h1>
        <p className="mt-1 text-slate-500 text-xs font-medium">
          Low-Poly Castle Siege Strategy
        </p>

        {/* Map Selector (2 Simple Buttons) */}
        <div className="grid grid-cols-2 gap-2 w-full mt-5">
          {(['ironhold_chasm', 'twin_bridges'] as MapId[]).map((mapId) => {
            const active = selectedMap === mapId;
            return (
              <button
                key={mapId}
                type="button"
                onClick={() => onSelectMap(mapId)}
                className={`p-3 rounded-2xl border-2 text-center transition-all cursor-pointer ${
                  active
                    ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 font-semibold'
                }`}
              >
                <div className="text-xs sm:text-sm truncate">{MAP_DEFS[mapId].name}</div>
              </button>
            );
          })}
        </div>

        {/* Primary Play Actions */}
        <div className="flex flex-col gap-2.5 w-full mt-4">
          <button
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStartAI();
            }}
            className="w-full h-12 flex items-center justify-center gap-2.5 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-sm shadow-md transition-all cursor-pointer"
          >
            <Bot className="w-5 h-5 shrink-0" />
            <span>Play Battle</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>

          <button
            onClick={(e) => {
              e.currentTarget.blur();
              onCreateMultiplayer();
            }}
            className="w-full h-12 flex items-center justify-center gap-2.5 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] border border-slate-200 text-slate-800 font-bold text-sm transition-all cursor-pointer"
          >
            <QrCode className="w-5 h-5 text-red-600 shrink-0" />
            <span>1v1 Multiplayer</span>
            <Users className="w-4 h-4 ml-1 text-slate-500" />
          </button>
        </div>

        {/* Join by Code */}
        <div className="w-full mt-3">
          {!showJoinInput ? (
            <button
              onClick={() => setShowJoinInput(true)}
              className="text-xs text-slate-500 hover:text-blue-600 font-semibold py-1 cursor-pointer"
            >
              Join with Room Code
            </button>
          ) : (
            <form
              onSubmit={handleJoinSubmit}
              className="flex gap-2 p-1.5 rounded-xl bg-slate-50 border border-slate-300"
            >
              <input
                type="text"
                aria-label="Room Code"
                placeholder="ROOM CODE"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="flex-1 bg-transparent px-3 py-1.5 text-sm text-center tracking-widest font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none uppercase"
                autoFocus
              />
              <button
                type="submit"
                disabled={joinCode.trim().length < 4}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs uppercase cursor-pointer"
              >
                Join
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
