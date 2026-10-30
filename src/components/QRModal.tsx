/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, Users, X } from 'lucide-react';

interface QRModalProps {
  roomId: string;
  opponentConnected: boolean;
  onClose: () => void;
  onStartNow: () => void;
}

export const QRModal: React.FC<QRModalProps> = ({
  roomId,
  opponentConnected,
  onClose,
  onStartNow,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?room=${roomId}`
      : `?room=${roomId}`;

  useEffect(() => {
    QRCode.toDataURL(inviteUrl, {
      margin: 1,
      width: 240,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code:', err));
  }, [inviteUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/40 pointer-events-auto">
      <div className="relative w-full max-w-sm rounded-3xl bg-white border border-slate-200 p-6 text-center shadow-2xl text-slate-900">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-center gap-2 mb-1">
          <Users className="w-5 h-5 text-blue-600" />
          <h2 className="font-['Cinzel'] font-bold text-lg text-slate-900">
            Invite Rival Commander
          </h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Scan with a smartphone camera or share the room code to play Blue vs. Red
        </p>

        {/* QR Code Frame */}
        <div className="mx-auto w-52 h-52 bg-slate-50 border border-slate-200 rounded-2xl p-2.5 shadow-inner flex items-center justify-center mb-4">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR Code for room ${roomId}`}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-xs text-slate-400">Generating QR...</div>
          )}
        </div>

        {/* 6-Digit Code Badge */}
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
            Room Code
          </div>
          <div className="font-mono text-2xl font-black tracking-widest text-blue-600 select-all">
            {roomId}
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-50 border border-slate-200 mb-4">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              opponentConnected ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          <span className="text-xs font-semibold text-slate-700">
            {opponentConnected
              ? 'Player 2 (Red Team) connected!'
              : 'Waiting for Player 2 (Red Team)...'}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold text-slate-800 transition-colors cursor-pointer"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Copy className="w-4 h-4 text-blue-600" />
            )}
            <span>{copied ? 'Link Copied to Clipboard!' : 'Copy Direct Room Link'}</span>
          </button>

          <button
            onClick={onStartNow}
            className="w-full mt-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider shadow-md transition-transform active:scale-[0.98] cursor-pointer"
          >
            Enter Battlefield Now
          </button>
        </div>
      </div>
    </div>
  );
};
