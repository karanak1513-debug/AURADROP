'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Copy,
  Check,
  QrCode,
  Flame,
  Lock,
  Users,
  ShieldAlert,
  Smartphone,
  X,
  Trash2,
  Key,
  Share2,
} from 'lucide-react';
import QRCode from 'qrcode';
import { PodMetadata, Peer } from '@/types/vault';
import { sound } from '@/lib/sound';
import { SocialShareModal } from './SocialShareModal';

interface WorkspaceHUDProps {
  metadata: PodMetadata;
  peers: Peer[];
  currentPeerId: string;
  passphrase?: string;
  onZeroize: () => void;
  isZeroizing?: boolean;
  onOpenLinktree?: () => void;
  activeTab?: 'files' | 'linktree';
  onOpenShare?: () => void;
}

export function WorkspaceHUD({
  metadata,
  peers,
  currentPeerId,
  passphrase,
  onZeroize,
  isZeroizing = false,
  onOpenLinktree,
  activeTab = 'files',
  onOpenShare,
}: WorkspaceHUDProps) {
  const [copied, setCopied] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showNukeModal, setShowNukeModal] = useState(false);
  const [nukeConfirmText, setNukeConfirmText] = useState('');

  const handleCopyPassword = () => {
    if (!passphrase) return;
    sound.playClick();
    navigator.clipboard.writeText(passphrase);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2000);
  };

  // Live Countdown Loop
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((metadata.expiresAt - now) / 1000));
      setSecondsRemaining(diff);

      if (diff === 0 && !isZeroizing) {
        onZeroize();
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [metadata.expiresAt, onZeroize, isZeroizing]);

  // Copy Full Share Link with URL fragment (#key=...)
  const handleCopyLink = () => {
    sound.playClick();
    if (typeof window === 'undefined') return;

    let fullUrl = window.location.href;
    if (!fullUrl.includes('#key=') && passphrase) {
      fullUrl = `${window.location.origin}/pod/${metadata.id}#key=${encodeURIComponent(passphrase)}`;
    }

    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // Generate Mobile QR Code
  const handleOpenQrModal = async () => {
    sound.playClick();
    if (typeof window === 'undefined') return;

    let targetUrl = window.location.href;
    if (!targetUrl.includes('#key=') && passphrase) {
      targetUrl = `${window.location.origin}/pod/${metadata.id}#key=${encodeURIComponent(passphrase)}`;
    }

    try {
      const dataUrl = await QRCode.toDataURL(targetUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF',
        },
      });
      setQrDataUrl(dataUrl);
      setShowQrModal(true);
    } catch (err) {
      console.error('QR Code generation error:', err);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const totalDuration = metadata.ttlSeconds || 3600;
  const progressPercent = Math.min(100, Math.max(0, (secondsRemaining / totalDuration) * 100));

  const isCritical = secondsRemaining <= 300; // < 5 minutes
  const isWarning = secondsRemaining <= 900 && !isCritical; // < 15 minutes

  const strokeColor = isCritical ? '#F43F5E' : isWarning ? '#F59E0B' : '#6366F1';
  const textColor = isCritical ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-slate-900';

  const handleTriggerNuke = () => {
    const entered = nukeConfirmText.trim().toUpperCase();
    if (entered !== 'DELETE' && entered !== 'ZEROIZE') {
      sound.playAlert();
      return;
    }
    sound.playNuke();
    setShowNukeModal(false);
    onZeroize();
  };

  return (
    <>
      <div className="glass-panel rounded-3xl p-4 sm:p-5 mb-6 shadow-premium relative border border-white/95">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Left: Room ID & Copy Link & Mobile QR */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <div className="flex items-center gap-2 bg-white/80 border border-slate-200/80 rounded-2xl px-3.5 py-1.5 shadow-xs">
              <span className="text-xs font-semibold text-slate-400">Room:</span>
              <span className="font-heading font-extrabold text-sm text-slate-900 tracking-tight">
                {metadata.id}
              </span>
            </div>

            {/* One-Click Copy Encrypted Link */}
            <button
              onClick={handleCopyLink}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer tactile-btn shadow-xs ${
                copied
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-indigo-50/80 hover:bg-indigo-100/80 border-indigo-200 text-indigo-700'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-indigo-600" />}
              <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
            </button>

            {/* 1-Tap Social Share Button (WhatsApp, Instagram, etc) */}
            <button
              onClick={() => {
                sound.playClick();
                if (onOpenShare) {
                  onOpenShare();
                } else {
                  setShowShareModal(true);
                }
              }}
              title="1-Tap Share to WhatsApp, Instagram, Telegram & more"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:opacity-95 text-white text-xs font-bold transition-all cursor-pointer tactile-btn shadow-xs shadow-emerald-500/20"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full font-extrabold bg-white/25 text-white">
                1-Tap
              </span>
            </button>

            {/* Copy Password Button */}
            {passphrase && (
              <button
                onClick={handleCopyPassword}
                title="Copy Room Secret Password"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold border transition-all cursor-pointer tactile-btn shadow-xs ${
                  copiedPass
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-white/80 hover:bg-white border-slate-200/80 text-slate-700'
                }`}
              >
                <Key className="w-3.5 h-3.5 text-indigo-600" />
                <span>{copiedPass ? 'Password Copied!' : 'Copy Password'}</span>
              </button>
            )}

            {/* Mobile QR Button */}
            <button
              onClick={handleOpenQrModal}
              title="Open room on your phone"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/80 hover:bg-white border border-slate-200/80 text-slate-700 text-xs font-semibold transition-colors cursor-pointer tactile-btn shadow-xs"
            >
              <QrCode className="w-3.5 h-3.5 text-cyan-600" />
              <span className="hidden sm:inline">Scan QR</span>
            </button>

            {/* Ephemeral Linktree & Smart QR Bundle Shortcut */}
            {onOpenLinktree && (
              <button
                onClick={() => {
                  sound.playClick();
                  onOpenLinktree();
                }}
                title="Open Ephemeral Linktree & Dynamic QR Bundle"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-semibold transition-all cursor-pointer tactile-btn shadow-xs ${
                  activeTab === 'linktree'
                    ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white border-transparent shadow-md shadow-indigo-500/20'
                    : 'bg-white/80 hover:bg-white border-slate-200/80 text-slate-700'
                }`}
              >
                <QrCode className="w-3.5 h-3.5 text-indigo-500" />
                <span className="hidden sm:inline">Linktree & QR</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-amber-400 text-slate-900">
                  NEW
                </span>
              </button>
            )}

            {metadata.burnOnDownload && (
              <span className="flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                <Flame className="w-3 h-3 text-amber-600" />
                Deletes on download
              </span>
            )}

            {metadata.readOnlyGuests && (
              <span className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
                <Lock className="w-3 h-3 text-slate-500" />
                Guest view-only
              </span>
            )}
          </div>

          {/* Center: Countdown Timer */}
          <div className="flex items-center gap-3.5 bg-white/70 border border-slate-200/80 rounded-2xl px-4 py-2 shadow-xs">
            <div className="relative w-10 h-10 flex items-center justify-center">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-200/80"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  strokeDasharray={`${progressPercent}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke={strokeColor}
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <Clock className={`w-4 h-4 absolute ${textColor} ${isCritical ? 'animate-pulse' : ''}`} />
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block font-semibold">
                Self-Destructs In
              </span>
              <span className={`font-mono font-black text-lg tracking-wider ${textColor} ${isCritical ? 'animate-pulse' : ''}`}>
                {formatTime(secondsRemaining)}
              </span>
            </div>
          </div>

          {/* Right: Connected People & Emergency Delete */}
          <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-end">
            {/* Active Participants */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-1 font-semibold">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span>{peers.length} online</span>
              </div>
              <div className="flex -space-x-2 overflow-hidden">
                {peers.map((peer) => (
                  <div
                    key={peer.id}
                    title={`${peer.codename} ${peer.id === currentPeerId ? '(You)' : ''}`}
                    className="relative group cursor-pointer"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white shadow-xs"
                      style={{ backgroundColor: peer.color || '#6366F1' }}
                    >
                      {peer.codename.substring(0, 2)}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
                  </div>
                ))}
              </div>
            </div>

            {/* "Erase Room" Button */}
            <button
              onClick={() => {
                sound.playAlert();
                setShowNukeModal(true);
              }}
              disabled={isZeroizing}
              className="py-2 px-4 rounded-2xl bg-white/80 hover:bg-rose-50 border border-rose-200/80 text-rose-600 hover:text-rose-700 text-xs font-bold flex items-center gap-2 transition-all shadow-xs hover:shadow-md hover:shadow-rose-500/20 tactile-btn cursor-pointer group"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500 group-hover:scale-110 transition-transform" />
              <span>Erase Room Now</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
          <div className="glass-panel rounded-3xl max-w-sm w-full p-6 relative shadow-2xl text-center border border-white/95">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-center gap-2 text-indigo-600 mb-2">
              <Smartphone className="w-5 h-5" />
              <h3 className="font-heading font-bold text-base text-slate-900 tracking-tight">
                Scan to Open on Phone
              </h3>
            </div>

            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Open your phone camera and point it at this QR code to join this private room immediately.
            </p>

            {qrDataUrl && (
              <div className="bg-white p-4 rounded-2xl inline-block mb-4 shadow-sm border border-slate-200/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt="Private Room QR Code"
                  className="w-56 h-56 mx-auto rounded-xl"
                />
              </div>
            )}

            {onOpenLinktree && (
              <button
                onClick={() => {
                  setShowQrModal(false);
                  onOpenLinktree();
                }}
                className="w-full mb-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:opacity-95 text-white font-heading font-bold text-xs transition-all shadow-md shadow-indigo-500/20 cursor-pointer flex items-center justify-center gap-2 tactile-btn"
              >
                <QrCode className="w-4 h-4" />
                <span>Open Linktree & Custom QR Studio</span>
              </button>
            )}

            <button
              onClick={() => {
                setShowQrModal(false);
                if (onOpenShare) {
                  onOpenShare();
                } else {
                  setShowShareModal(true);
                }
              }}
              className="w-full mb-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:opacity-95 text-white font-heading font-bold text-xs transition-all shadow-md shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2 tactile-btn"
            >
              <Share2 className="w-4 h-4" />
              <span>Share to WhatsApp & Instagram</span>
            </button>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Confirm Erase Modal */}
      {showNukeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-4">
          <div className="glass-panel border-2 border-rose-400/90 rounded-3xl max-w-md w-full p-6 sm:p-7 relative shadow-2xl bg-white/95">
            <div className="flex items-center gap-3 text-rose-600 mb-4 pb-3 border-b border-rose-100">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shrink-0 shadow-xs">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="font-heading font-black text-lg text-slate-900 tracking-tight">
                Erase This Room Completely?
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              This will <strong className="text-rose-600 font-semibold">permanently delete all files, chat messages, and data</strong> in this room. Nothing can ever be recovered.
            </p>

            <div className="bg-rose-50/60 border border-rose-200/80 p-3.5 rounded-2xl mb-5">
              <label className="text-xs text-slate-700 block mb-2 font-bold">
                Type <span className="text-rose-600 underline">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={nukeConfirmText}
                onChange={(e) => setNukeConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full bg-white border border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 rounded-xl px-3 py-2 text-xs font-mono font-bold text-rose-700 outline-none uppercase shadow-xs"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowNukeModal(false);
                  setNukeConfirmText('');
                }}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleTriggerNuke}
                disabled={nukeConfirmText.trim().toUpperCase() !== 'DELETE' && nukeConfirmText.trim().toUpperCase() !== 'ZEROIZE'}
                className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-rose-500/25 transition-all tactile-btn cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Erase Everything</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1-Tap Social Share & Auto-Join Modal */}
      <SocialShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        metadata={metadata}
        passphrase={passphrase}
        secondsRemaining={secondsRemaining}
      />
    </>
  );
}
