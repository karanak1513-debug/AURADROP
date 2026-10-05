'use client';

import React, { useState } from 'react';
import { CountdownGauge } from './CountdownGauge';
import { NukeModal } from './NukeModal';
import { 
  ShieldCheck, 
  Users, 
  Flame, 
  QrCode, 
  Copy, 
  Check, 
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';

interface TopHeaderProps {
  roomId: string;
  remainingSeconds: number;
  totalSeconds: number;
  peerCount: number;
  onEmergencyPurge: () => void;
  isPurging: boolean;
}

export function TopHeader({
  roomId,
  remainingSeconds,
  totalSeconds,
  peerCount,
  onEmergencyPurge,
  isPurging,
}: TopHeaderProps) {
  const [showNukeModal, setShowNukeModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const isCritical = remainingSeconds <= 300 && remainingSeconds > 0;

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <header className="sticky top-4 z-40 w-full max-w-7xl mx-auto px-4 mb-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-3 rounded-3xl bg-white/75 backdrop-blur-3xl border border-white/95 shadow-xl shadow-slate-200/50">
          {/* Left: Brand & Return */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <Link
              href="/"
              className="flex items-center gap-2 p-2 rounded-2xl hover:bg-slate-100/60 text-slate-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-md shadow-indigo-500/20">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm tracking-tight text-slate-900 hidden sm:inline">
                AURA DROP
              </span>
            </Link>

            {/* Room Identifier Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-100/80 border border-slate-200/60">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="font-mono text-xs font-bold text-slate-800 tracking-wider">
                {roomId}
              </span>
            </div>

            {/* Security Badge */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 text-[11px] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>CLIENT SANDBOX SECURE &amp; E2EE ACTIVE</span>
            </div>
          </div>

          {/* Right: Peers, Countdown Gauge, Share & Nuke */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {/* Connected Peers */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/80 border border-slate-200/60 shadow-sm text-xs text-slate-600 font-medium">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>{peerCount} Active</span>
            </div>

            {/* Circular Countdown Gauge */}
            <CountdownGauge
              remainingSeconds={remainingSeconds}
              totalSeconds={totalSeconds}
              isCritical={isCritical}
            />

            {/* Copy / Share Button */}
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/80 hover:bg-white border border-slate-200/80 text-slate-700 text-xs font-semibold shadow-sm transition-all cursor-pointer"
              title="Copy secure link with zero-knowledge key hash"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Invite Peer</span>
                </>
              )}
            </button>

            {/* Instant Purge / Nuke Button */}
            <button
              onClick={() => setShowNukeModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 text-xs font-bold shadow-sm transition-all cursor-pointer group"
            >
              <Flame className="w-3.5 h-3.5 text-rose-500 group-hover:scale-110 transition-transform" />
              <span>Nuke Pod</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mechanical Slide-to-Confirm Purge Modal */}
      {showNukeModal && (
        <NukeModal
          isNuking={isPurging}
          onConfirm={() => {
            setShowNukeModal(false);
            onEmergencyPurge();
          }}
          onCancel={() => setShowNukeModal(false)}
        />
      )}
    </>
  );
}
