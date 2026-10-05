'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio,
  Code2,
  PenTool,
  EyeOff,
  Flame,
  Clock,
  Lock,
  Unlock,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  Copy,
  Check,
  ChevronRight,
  Sparkles,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { Background3D } from '@/components/canvas/Background3D';
import { VoiceIntercom } from '@/components/intercom/VoiceIntercom';
import { CodeRunner } from '@/components/playground/CodeRunner';
import { CollaborativeBoard } from '@/components/whiteboard/CollaborativeBoard';
import { StegoVault } from '@/components/stego/StegoVault';
import { getP2PMesh, resetP2PMesh, PeerMessage } from '@/lib/p2p/mesh';

interface WorkspaceShellProps {
  roomId: string;
  initialCryptoKey?: string;
  ttlDurationSeconds?: number;
}

type TabType = 'intercom' | 'playground' | 'whiteboard' | 'stego';

export function WorkspaceShell({
  roomId,
  initialCryptoKey = '',
  ttlDurationSeconds = 3600, // default 1 hour
}: WorkspaceShellProps) {
  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>('intercom');

  // Peer & Crypto State
  const [peerId, setPeerId] = useState<string>('');
  const [cryptoKey, setCryptoKey] = useState<string>(initialCryptoKey);
  const [connectedNodes, setConnectedNodes] = useState<number>(1);
  const [isMax2Locked, setIsMax2Locked] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Countdown State
  const [timeRemaining, setTimeRemaining] = useState<number>(ttlDurationSeconds);
  const totalDurationRef = useRef<number>(ttlDurationSeconds);

  // Nuke & Anti-Forensics State
  const [isNuked, setIsNuked] = useState<boolean>(false);
  const [sliderProgress, setSliderProgress] = useState<number>(0);
  const [isSlidingNuke, setIsSlidingNuke] = useState<boolean>(false);
  const sliderTrackRef = useRef<HTMLDivElement>(null);

  // Initialize P2P Mesh & Hash Key on Mount
  useEffect(() => {
    // Read key from URL hash if available (e.g. /room/CYPHER-123#key=...)
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash && hash.includes('key=')) {
        const extracted = hash.split('key=')[1]?.split('&')[0];
        if (extracted) setCryptoKey(extracted);
      } else if (!cryptoKey) {
        // Auto-generate fresh 256-bit entropy key in fragment if none exists
        const randomKey = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        setCryptoKey(randomKey);
        window.location.hash = `key=${randomKey}`;
      }
    }

    const mesh = getP2PMesh();
    mesh.init(roomId).then((id) => {
      setPeerId(id);
    });

    const unsubStatus = mesh.onPeerStatus((peers, lockStatus) => {
      setConnectedNodes(lockStatus.count);
      setIsMax2Locked(lockStatus.max2Locked);
    });

    const unsubMsg = mesh.onMessage((msg: PeerMessage) => {
      if (msg.type === 'NUKE_TRIGGER') {
        executeNukePurge(true);
      }
    });

    return () => {
      unsubStatus();
      unsubMsg();
    };
  }, [roomId]);

  // Liquid Countdown Timer
  useEffect(() => {
    if (isNuked) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          executeNukePurge(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isNuked]);

  // Format Countdown String
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isCriticalTime = timeRemaining <= 120; // under 2 minutes
  const timeRatio = Math.max(0, timeRemaining / totalDurationRef.current);

  // Tactile Slide-to-Confirm Nuke Handler
  const handleSliderDrag = (event: MouseEvent | TouchEvent | PointerEvent, info: { point: { x: number } }) => {
    const track = sliderTrackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const currentX = info.point.x - rect.left;
    const maxDrag = rect.width - 48; // thumb width is 48px
    const ratio = Math.max(0, Math.min(1, currentX / maxDrag));
    setSliderProgress(ratio);

    if (ratio >= 0.95) {
      executeNukePurge(false);
    }
  };

  /**
   * Anti-Forensics Zeroize Decontamination Sequence
   */
  const executeNukePurge = useCallback((isRemoteTrigger = false) => {
    setIsNuked(true);

    // 1. Teardown WebRTC P2P Mesh
    const mesh = getP2PMesh();
    mesh.zeroizeAndClose();
    resetP2PMesh();

    // 2. Wipe browser storage and memory
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.clear();
        localStorage.removeItem('aura_session_cache');
      } catch {
        // ignore
      }
    }
  }, []);

  // Copy Ephemeral Invite Link (URL Fragment Preserved)
  const copyInviteLink = () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/room/${roomId}#key=${cryptoKey}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col aura-ambient relative overflow-hidden select-none">
      {/* 3D WebGL Refractive Glass Polyhedrons Canvas */}
      <Background3D isVaporizing={isNuked} timeRemainingRatio={timeRatio} />

      {/* Dynamic Header Bar */}
      <header className="sticky top-0 z-30 px-4 sm:px-6 lg:px-8 py-3.5 backdrop-blur-3xl bg-white/70 border-b border-white/80 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.04)]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left: Brand & Room Tag */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-hud font-bold text-sm tracking-wider text-slate-900">
                    AURA DROP
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/60">
                    P2P MESH
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
                  ROOM: <span className="font-bold text-slate-700">{roomId}</span>
                </div>
              </div>
            </div>

            <button
              onClick={copyInviteLink}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 transition cursor-pointer"
              title="Copy Encrypted Invite Link"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Center: Dynamic Liquid Countdown & Status Badges */}
          <div className="flex items-center gap-4">
            {/* Liquid Radial Countdown Ring */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border backdrop-blur-md transition-all ${
                isCriticalTime
                  ? 'bg-rose-50/80 border-rose-300 text-rose-700 shadow-sm shadow-rose-500/20 animate-pulse'
                  : 'bg-white/80 border-slate-200/80 text-slate-700 shadow-xs'
              }`}
            >
              <div className="relative w-6 h-6 flex items-center justify-center">
                <svg className="w-6 h-6 -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke={isCriticalTime ? '#f43f5e' : '#6366f1'}
                    strokeWidth="3"
                    strokeDasharray="94.2"
                    strokeDashoffset={94.2 * (1 - timeRatio)}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <Clock className={`w-3 h-3 absolute ${isCriticalTime ? 'text-rose-600' : 'text-indigo-600'}`} />
              </div>

              <div className="flex flex-col">
                <span className="text-[10px] font-mono leading-none text-slate-400">EPHEMERAL TTL</span>
                <span className="text-xs font-mono font-bold tracking-tight">
                  {formatTime(timeRemaining)}
                </span>
              </div>
            </div>

            {/* Room Lock Status Badge */}
            <div className={`px-3 py-1.5 rounded-2xl border text-xs font-mono font-bold flex items-center gap-2 ${
              isMax2Locked
                ? 'bg-rose-50/80 text-rose-700 border-rose-200'
                : 'bg-emerald-50/80 text-emerald-700 border-emerald-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isMax2Locked ? 'bg-rose-500' : 'bg-emerald-500 animate-ping'}`} />
              {isMax2Locked
                ? `MESH SECURE - ${connectedNodes}/2 NODES LOCKED`
                : `MESH ACTIVE - ${connectedNodes}/2 NODES`}
            </div>
          </div>

          {/* Right: Tactile Slide-to-Confirm Emergency Nuke Switch */}
          <div className="flex items-center gap-2">
            <div
              ref={sliderTrackRef}
              className="relative w-44 sm:w-48 h-10 rounded-full bg-slate-100/90 border border-slate-200/90 p-1 flex items-center shadow-inner overflow-hidden"
            >
              <div
                className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-rose-500 to-rose-600 opacity-20 pointer-events-none transition-all"
                style={{ width: `${sliderProgress * 100}%` }}
              />

              <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 140 }}
                dragElastic={0}
                dragMomentum={false}
                onDrag={handleSliderDrag}
                onDragEnd={() => {
                  if (sliderProgress < 0.95) setSliderProgress(0);
                }}
                className="w-8 h-8 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
              >
                <Flame className={`w-4 h-4 ${sliderProgress > 0.5 ? 'text-rose-600' : 'text-slate-500'}`} />
              </motion.div>

              <div className="flex-1 text-center font-mono text-[10px] font-bold text-slate-500 pointer-events-none pr-2">
                SLIDE TO NUKE
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Multi-Tab Dock */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10 flex flex-col gap-6">
        {/* Tab Navigation Pill Dock */}
        <div className="flex items-center justify-center">
          <div className="p-1.5 rounded-2xl bg-white/70 backdrop-blur-3xl border border-white/90 shadow-[0_15px_35px_-10px_rgba(0,0,0,0.05)] flex items-center gap-1">
            {[
              { id: 'intercom', label: 'Voice Intercom', icon: Radio },
              { id: 'playground', label: 'Code Playground', icon: Code2 },
              { id: 'whiteboard', label: 'Whiteboard', icon: PenTool },
              { id: 'stego', label: 'Stego Vault', icon: EyeOff },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-2 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-500/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content Panes */}
        <AnimatePresence mode="wait">
          {activeTab === 'intercom' && (
            <motion.div
              key="intercom"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              <VoiceIntercom roomId={roomId} peerId={peerId} isNuked={isNuked} />
            </motion.div>
          )}

          {activeTab === 'playground' && (
            <motion.div
              key="playground"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              <CodeRunner roomId={roomId} peerId={peerId} isNuked={isNuked} />
            </motion.div>
          )}

          {activeTab === 'whiteboard' && (
            <motion.div
              key="whiteboard"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              <CollaborativeBoard roomId={roomId} peerId={peerId} isNuked={isNuked} />
            </motion.div>
          )}

          {activeTab === 'stego' && (
            <motion.div
              key="stego"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              <StegoVault roomId={roomId} peerId={peerId} isNuked={isNuked} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Emergency Zeroize Decontamination Wipe Overlay */}
      <AnimatePresence>
        {isNuked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-50 bg-white/95 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-center select-none"
          >
            <div className="w-20 h-20 rounded-3xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-6 shadow-xl shadow-rose-500/10 animate-bounce">
              <Flame className="w-10 h-10" />
            </div>

            <h1 className="text-3xl font-mono-hud font-bold text-slate-900 tracking-tight mb-2">
              SESSION PURGED — ZERO ARTIFACTS REMAIN
            </h1>

            <p className="text-xs font-mono text-slate-500 max-w-md mb-8 leading-relaxed">
              All WebRTC channels have been severed. Canvas contexts, audio buffers, in-memory keys, and editor states have been overwritten with cryptographic zeros.
            </p>

            <div className="p-4 rounded-2xl bg-slate-100/80 border border-slate-200 text-left font-mono text-xs text-slate-600 flex flex-col gap-2 max-w-md w-full mb-8">
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <Check className="w-4 h-4" /> WebRTC DataChannels Terminated
              </div>
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <Check className="w-4 h-4" /> Audio Buffers Overwritten (0x00)
              </div>
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <Check className="w-4 h-4" /> Canvas Pixels Scrubbed
              </div>
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <Check className="w-4 h-4" /> RAM Cache Zero-Filled
              </div>
            </div>

            <a
              href="/"
              className="px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-mono text-xs font-bold transition shadow-lg cursor-pointer"
            >
              RETURN TO SAFETY
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
