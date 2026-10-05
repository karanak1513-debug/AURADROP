'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Shield,
  Key,
  Lock,
  Flame,
  ArrowRight,
  RefreshCw,
  Sparkles,
  HardDrive,
  MessageSquare,
  QrCode,
  Eye,
  EyeOff,
  Dices,
  Copy,
  Check,
  ExternalLink,
  Infinity as InfinityIcon,
  Zap,
  ShieldCheck,
  ShieldAlert,
  Radio,
} from 'lucide-react';
import { generateNATORoomId, generateSecurePassphrase, generateSalt } from '@/lib/crypto';
import { PodTTL } from '@/types/vault';
import { sound } from '@/lib/sound';
import { useAuth } from '@/context/AuthContext';

export function LandingHub() {
  const router = useRouter();
  const { user } = useAuth();

  // Active Isolated Studio ('ONE TIME, ONE THING')
  const [activeStudio, setActiveStudio] = useState<'drop' | 'chat' | 'links'>('drop');

  // 1. DROP VAULT ISOLATED STATE
  const [dropId, setDropId] = useState<string>(() => generateNATORoomId());
  const [dropPassphrase, setDropPassphrase] = useState<string>(() => generateSecurePassphrase());
  const [dropTtl, setDropTtl] = useState<PodTTL>('1h');
  const [dropBurnOnDownload, setDropBurnOnDownload] = useState<boolean>(true);
  const [dropShowPass, setDropShowPass] = useState<boolean>(false);
  const [dropCopied, setDropCopied] = useState<boolean>(false);

  // 2. CHAT ISOLATED STATE
  const [chatId, setChatId] = useState<string>(() => generateNATORoomId());
  const [chatPassphrase, setChatPassphrase] = useState<string>(() => generateSecurePassphrase());
  const [chatTtl, setChatTtl] = useState<PodTTL>('1h');
  const [chatPrivacyShield, setChatPrivacyShield] = useState<boolean>(true);
  const [chatShowPass, setChatShowPass] = useState<boolean>(false);
  const [chatCopied, setChatCopied] = useState<boolean>(false);

  // 3. LINKTREE ISOLATED STATE
  const [linkId, setLinkId] = useState<string>(() => generateNATORoomId());
  const [linkPassphrase, setLinkPassphrase] = useState<string>(() => generateSecurePassphrase());
  const [linkTtl, setLinkTtl] = useState<PodTTL>('never');
  const [linkDynamicQr, setLinkDynamicQr] = useState<boolean>(true);
  const [linkShowPass, setLinkShowPass] = useState<boolean>(false);
  const [linkCopied, setLinkCopied] = useState<boolean>(false);

  // Launching telemetry & spinner
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [telemetryStage, setTelemetryStage] = useState<string>('');

  // UNIVERSAL QUICK UNLOCK STATE
  const [joinRoomId, setJoinRoomId] = useState<string>('');
  const [joinPassphrase, setJoinPassphrase] = useState<string>('');
  const [joinModule, setJoinModule] = useState<'auto' | 'drop' | 'chat' | 'links'>('auto');
  const [joinError, setJoinError] = useState<string>('');

  // Auto-detect ?join=, ?room=, or ?pod=
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const targetRoom = params.get('join') || params.get('room') || params.get('pod');
    const targetKey =
      params.get('key') || params.get('k') || params.get('passphrase') || params.get('pass') || '';

    if (targetRoom) {
      const roomUpper = targetRoom.trim().toUpperCase();
      if (targetKey) {
        sound.playSuccess?.();
        router.push(
          `/drop/${encodeURIComponent(roomUpper)}#key=${encodeURIComponent(targetKey.trim())}`
        );
      } else {
        setJoinRoomId(roomUpper);
      }
    }
  }, [router]);

  // Copy helper
  const copyToClipboard = (text: string, setSuccess: (val: boolean) => void) => {
    sound.playClick?.();
    navigator.clipboard.writeText(text);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };

  // Launch Drop Flow
  const handleLaunchDrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dropId.trim() || !dropPassphrase.trim()) return;

    try {
      setIsDeploying(true);
      sound.playClick?.();
      setTelemetryStage('Deriving AES-256-GCM vault key…');

      const salt = generateSalt();
      await new Promise((r) => setTimeout(r, 80));
      setTelemetryStage('Allocating ephemeral memory pod…');

      const res = await fetch('/api/pods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: dropId.trim().toUpperCase(),
          salt,
          ttl: dropTtl,
          burnOnDownload: dropBurnOnDownload,
          burnOnEmpty: true,
        }),
      });

      if (!res.ok) throw new Error('Failed to create drop pod');

      setTelemetryStage('Entering Drop Vault…');
      sound.playSuccess?.();
      await new Promise((r) => setTimeout(r, 100));
      router.push(`/drop/${encodeURIComponent(dropId.trim().toUpperCase())}#key=${encodeURIComponent(dropPassphrase.trim())}`);
    } catch (err) {
      console.error(err);
      setIsDeploying(false);
      sound.playAlert?.();
      alert('Could not initialize Drop Vault. Please retry.');
    }
  };

  // Launch Chat Flow
  const handleLaunchChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatId.trim() || !chatPassphrase.trim()) return;

    try {
      setIsDeploying(true);
      sound.playClick?.();
      setTelemetryStage('Deriving E2EE ratchet salt…');

      const salt = generateSalt();
      await new Promise((r) => setTimeout(r, 80));
      setTelemetryStage('Opening encrypted ephemeral socket…');

      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: chatId.trim().toUpperCase(),
          salt,
          ttl: chatTtl,
          hostPeerId: `host-${Date.now().toString(36)}`,
          burnOnEmpty: true,
        }),
      });

      if (!res.ok) throw new Error('Failed to create chat room');

      setTelemetryStage('Connecting to Aura Chat…');
      sound.playSuccess?.();
      await new Promise((r) => setTimeout(r, 100));
      router.push(`/chat/${encodeURIComponent(chatId.trim().toUpperCase())}#key=${encodeURIComponent(chatPassphrase.trim())}`);
    } catch (err) {
      console.error(err);
      setIsDeploying(false);
      sound.playAlert?.();
      alert('Could not initialize Chat Room. Please retry.');
    }
  };

  // Launch Linktree Flow
  const handleLaunchLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkId.trim() || !linkPassphrase.trim()) return;

    try {
      setIsDeploying(true);
      sound.playClick?.();
      setTelemetryStage('Generating dynamic QR manifest…');

      const salt = generateSalt();
      await new Promise((r) => setTimeout(r, 80));
      setTelemetryStage('Configuring Linktree pod…');

      const res = await fetch('/api/pods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: linkId.trim().toUpperCase(),
          salt,
          ttl: linkTtl,
          burnOnDownload: false,
          burnOnEmpty: linkTtl !== 'never',
        }),
      });

      if (!res.ok) throw new Error('Failed to create Linktree pod');

      setTelemetryStage('Opening Linktree Studio…');
      sound.playSuccess?.();
      await new Promise((r) => setTimeout(r, 100));
      router.push(`/links/${encodeURIComponent(linkId.trim().toUpperCase())}#key=${encodeURIComponent(linkPassphrase.trim())}`);
    } catch (err) {
      console.error(err);
      setIsDeploying(false);
      sound.playAlert?.();
      alert('Could not initialize Linktree Studio. Please retry.');
    }
  };

  // Universal Join Handler
  const handleUniversalJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinRoomId.trim()) {
      setJoinError('Please enter a room code or share link.');
      sound.playAlert?.();
      return;
    }

    let targetRoom = joinRoomId.trim();
    let targetKey = joinPassphrase.trim();
    let targetMod = joinModule;

    // Check if input was a full URL
    if (targetRoom.includes('http://') || targetRoom.includes('https://') || targetRoom.includes('/')) {
      try {
        const urlStr = targetRoom.startsWith('http') ? targetRoom : `https://${targetRoom}`;
        const parsed = new URL(urlStr);

        if (parsed.pathname.includes('/drop/')) targetMod = 'drop';
        else if (parsed.pathname.includes('/chat/')) targetMod = 'chat';
        else if (parsed.pathname.includes('/links/')) targetMod = 'links';
        else if (parsed.pathname.includes('/pod/')) targetMod = 'pod' as any;

        const pathParts = parsed.pathname.split('/').filter(Boolean);
        targetRoom = pathParts[pathParts.length - 1] || targetRoom;

        if (parsed.hash.includes('key=')) {
          const keyParam = parsed.hash.split('key=')[1]?.split('&')[0];
          if (keyParam) targetKey = decodeURIComponent(keyParam);
        }
      } catch {
        // Ignore URL parse error
      }
    }

    if (targetMod === 'auto') {
      targetMod = 'drop';
    }

    if (!targetKey) {
      setJoinError('Please enter the secret decryption password.');
      sound.playAlert?.();
      return;
    }

    sound.playClick?.();
    router.push(`/${targetMod}/${encodeURIComponent(targetRoom.toUpperCase())}#key=${encodeURIComponent(targetKey)}`);
  };

  return (
    <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-14 w-full">
      {/* ── 1. Hero Title & Value Proposition (Dark Luxury Aesthetic) ── */}
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
        {/* Luxury 3D Frosted Glass Logo Emblem */}
        <div className="flex justify-center mb-5">
          <div className="relative group">
            <div className="absolute -inset-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 rounded-3xl blur-2xl opacity-40 group-hover:opacity-75 transition duration-500 animate-pulse" />
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-3xl p-1 bg-[#0D1222]/90 backdrop-blur-2xl border border-white/20 shadow-[0_20px_50px_-5px_rgba(99,102,241,0.35)] flex items-center justify-center group-hover:scale-105 transition-all duration-300">
              <Image
                src="/logo.png"
                alt="AuraDrop Logo"
                width={80}
                height={80}
                className="w-full h-full object-cover rounded-2xl"
                priority
              />
            </div>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-300 text-xs font-semibold mb-6 shadow-xs backdrop-blur-2xl">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span>Zero Server Logs · In-Memory Cryptographic Execution</span>
        </div>

        <h1 className="text-3xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.1] font-heading">
          Private by Default. <br />
          <span className="shimmer-text font-black">
            Ephemeral by Design.
          </span>
        </h1>

        <p className="mt-4 sm:mt-5 text-xs sm:text-base md:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto font-normal px-2">
          Three strictly isolated privacy suites: <strong className="text-white font-semibold">Secret File Drop</strong>, <strong className="text-white font-semibold">Real-Time Chat</strong>, and <strong className="text-white font-semibold">Smart QR Links</strong>. One tool at a time. Zero unified bloat.
        </p>
      </div>

      {/* ── 2. "ONE TIME, ONE THING" Segmented Studio Switcher ── */}
      <div className="flex justify-center mb-6 sm:mb-8 px-1">
        <div className="w-full sm:w-auto p-1 sm:p-1.5 rounded-2xl bg-[#0D1222]/90 backdrop-blur-2xl border border-white/10 shadow-[0_15px_40px_-10px_rgba(0,0,0,0.8)] grid grid-cols-3 gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={() => { sound.playClick?.(); setActiveStudio('drop'); }}
            className={`w-full px-2 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
              activeStudio === 'drop'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400 shrink-0" />
            <span className="hidden sm:inline">1. Secret Drop Vault</span>
            <span className="sm:hidden">Drop</span>
          </button>

          <button
            type="button"
            onClick={() => { sound.playClick?.(); setActiveStudio('chat'); }}
            className={`w-full px-2 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
              activeStudio === 'chat'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">2. Real-Time Chat</span>
            <span className="sm:hidden">Chat</span>
          </button>

          <button
            type="button"
            onClick={() => { sound.playClick?.(); setActiveStudio('links'); }}
            className={`w-full px-2 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
              activeStudio === 'links'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400 shrink-0" />
            <span className="hidden sm:inline">3. Smart Linktree</span>
            <span className="sm:hidden">Links</span>
          </button>
        </div>
      </div>

      {/* ── 3. Dedicated Isolated Studio Launcher + Universal Unlocker ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start mb-12 sm:mb-16">
        
        {/* ── Studio Creator (7 cols) - Dark Luxury Glass Card ── */}
        <div className="lg:col-span-7 apple-frosted-glass apple-frosted-card rounded-3xl p-4 sm:p-8 shadow-2xl border border-white/10">
          
          {/* ===================== STUDIO 1: SECRET FILE DROP ===================== */}
          {activeStudio === 'drop' && (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-5 border-b border-white/10 mb-6">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold shadow-xs">
                    <HardDrive className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-heading font-black text-white tracking-tight">
                        Secret Drop Vault
                      </h2>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        Drop Only
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Anonymous, single-download file delivery with memory burn.</p>
                  </div>
                </div>
                <Link
                  href="/drop"
                  className="hidden sm:flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                  title="Open dedicated drop page"
                >
                  <span>Standalone Studio</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>

              <form onSubmit={handleLaunchDrop} className="space-y-5">
                {/* Drop Code */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-300">Drop Vault Identifier</label>
                    <button
                      type="button"
                      onClick={() => { sound.playClick?.(); setDropId(generateNATORoomId()); }}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Dices className="w-3.5 h-3.5" />
                      <span>Randomize</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={dropId}
                    onChange={(e) => setDropId(e.target.value.toUpperCase())}
                    className="w-full apple-frosted-input rounded-2xl px-4 py-3 text-base sm:text-sm font-mono font-bold text-white outline-none uppercase tracking-wider"
                    required
                  />
                </div>

                {/* Secret Key */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-300">AES-256 Client-Side Secret Key</label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(`Drop: ${dropId}\nKey: ${dropPassphrase}`, setDropCopied)}
                        className="text-xs font-semibold text-slate-400 hover:text-indigo-400 flex items-center gap-1 cursor-pointer"
                      >
                        {dropCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{dropCopied ? 'Copied' : 'Copy Key'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { sound.playKey?.(); setDropPassphrase(generateSecurePassphrase()); }}
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Dices className="w-3.5 h-3.5" />
                        <span>Regenerate</span>
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type={dropShowPass ? 'text' : 'password'}
                      value={dropPassphrase}
                      onChange={(e) => setDropPassphrase(e.target.value)}
                      className="w-full apple-frosted-input rounded-2xl px-4 py-3 text-base sm:text-sm font-mono text-white outline-none pr-11"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setDropShowPass(!dropShowPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer p-1"
                    >
                      {dropShowPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 font-normal">
                    Files are encrypted in your browser before upload. Plaintext is never seen by the server.
                  </p>
                </div>

                {/* Self-Destruct Timer */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">Vault Self-Destruct Timer</label>
                  <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                    {(['15m', '1h', '6h', '24h'] as PodTTL[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => { sound.playClick?.(); setDropTtl(t); }}
                        className={`py-2 px-1 sm:px-3 rounded-2xl text-[11px] sm:text-xs font-bold border transition-all cursor-pointer ${
                          dropTtl === t
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/25'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                        }`}
                      >
                        {t === '15m' ? '15 Min' : t === '1h' ? '1 Hour' : t === '6h' ? '6 Hours' : '24 Hours'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Drop-Specific Options */}
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-3 p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 cursor-pointer hover:bg-indigo-500/15 transition-colors">
                    <input
                      type="checkbox"
                      checked={dropBurnOnDownload}
                      onChange={(e) => setDropBurnOnDownload(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 bg-slate-950 border-slate-700"
                    />
                    <div>
                      <p className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-rose-400" />
                        <span>Burn Files on Download</span>
                      </p>
                      <p className="text-[11px] text-slate-400">Shared files immediately self-destruct once downloaded by recipient.</p>
                    </div>
                  </label>
                </div>

                {/* Launch Button */}
                <button
                  type="submit"
                  disabled={isDeploying}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-heading font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-indigo-500/30 transition-all cursor-pointer tactile-btn disabled:opacity-50"
                >
                  {isDeploying ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{telemetryStage}</span>
                    </>
                  ) : (
                    <>
                      <span>Launch Secret Drop Vault</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ===================== STUDIO 2: REAL-TIME EPHEMERAL CHAT ===================== */}
          {activeStudio === 'chat' && (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-5 border-b border-white/10 mb-6">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shadow-xs">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-heading font-black text-white tracking-tight">
                        Real-Time Ephemeral Chat
                      </h2>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Chat Only
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Google-verified E2EE messenger with double blue ticks & privacy shield.</p>
                  </div>
                </div>
                <Link
                  href="/chat"
                  className="hidden sm:flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                  title="Open dedicated chat page"
                >
                  <span>Standalone Studio</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>

              <form onSubmit={handleLaunchChat} className="space-y-5">
                {/* Chat Room Codename */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-300">Chat Room Codename</label>
                    <button
                      type="button"
                      onClick={() => { sound.playClick?.(); setChatId(generateNATORoomId()); }}
                      className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Dices className="w-3.5 h-3.5" />
                      <span>Randomize</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value.toUpperCase())}
                    className="w-full apple-frosted-input rounded-2xl px-4 py-3 text-base sm:text-sm font-mono font-bold text-white outline-none uppercase tracking-wider"
                    required
                  />
                </div>

                {/* Secret Key */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-300">E2EE Ratchet Encryption Key</label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(`Chat: ${chatId}\nKey: ${chatPassphrase}`, setChatCopied)}
                        className="text-xs font-semibold text-slate-400 hover:text-emerald-400 flex items-center gap-1 cursor-pointer"
                      >
                        {chatCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{chatCopied ? 'Copied' : 'Copy Key'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { sound.playKey?.(); setChatPassphrase(generateSecurePassphrase()); }}
                        className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Dices className="w-3.5 h-3.5" />
                        <span>Regenerate</span>
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type={chatShowPass ? 'text' : 'password'}
                      value={chatPassphrase}
                      onChange={(e) => setChatPassphrase(e.target.value)}
                      className="w-full apple-frosted-input rounded-2xl px-4 py-3 text-base sm:text-sm font-mono text-white outline-none pr-11"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setChatShowPass(!chatShowPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer p-1"
                    >
                      {chatShowPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 font-normal">
                    Derived into an AES-256-GCM session key. Messages exist purely in volatile memory.
                  </p>
                </div>

                {/* Chat Session Timer */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">Room Auto-Vaporize Timer</label>
                  <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                    {(['15m', '1h', '6h', '24h'] as PodTTL[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => { sound.playClick?.(); setChatTtl(t); }}
                        className={`py-2 px-1 sm:px-3 rounded-2xl text-[11px] sm:text-xs font-bold border transition-all cursor-pointer ${
                          chatTtl === t
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/25'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                        }`}
                      >
                        {t === '15m' ? '15 Min' : t === '1h' ? '1 Hour' : t === '6h' ? '6 Hours' : '24 Hours'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chat Privacy Shield Toggle */}
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/15 transition-colors">
                    <input
                      type="checkbox"
                      checked={chatPrivacyShield}
                      onChange={(e) => setChatPrivacyShield(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 accent-emerald-600 bg-slate-950 border-slate-700"
                    />
                    <div>
                      <p className="text-xs font-bold text-white flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Privacy Guard & Screen Capture Shield</span>
                      </p>
                      <p className="text-[11px] text-slate-400">Blurs chat canvas on window blur and detects screenshot keystrokes.</p>
                    </div>
                  </label>
                </div>

                {/* Google Auth Status Badge */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-black/30 border border-white/10 text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-slate-300 font-medium">
                      {user ? `Signed in as ${user.displayName || user.email}` : 'Google Auth enforced on room entrance'}
                    </span>
                  </div>
                  <span className="font-bold text-emerald-400 text-[11px]">
                    {user ? 'Verified' : 'Required'}
                  </span>
                </div>

                {/* Launch Button */}
                <button
                  type="submit"
                  disabled={isDeploying}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-heading font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-500/30 transition-all cursor-pointer tactile-btn disabled:opacity-50"
                >
                  {isDeploying ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{telemetryStage}</span>
                    </>
                  ) : (
                    <>
                      <span>Start Private Chat Room</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ===================== STUDIO 3: SMART LINKTREE & DYNAMIC QR ===================== */}
          {activeStudio === 'links' && (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-5 border-b border-white/10 mb-6">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold shadow-xs">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-heading font-black text-white tracking-tight">
                        Smart Linktree Studio
                      </h2>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Links & QR
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Bundle your URLs into high-aesthetic Linktree with dynamic QR codes.</p>
                  </div>
                </div>
                <Link
                  href="/links"
                  className="hidden sm:flex items-center gap-1 text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors"
                  title="Open dedicated links page"
                >
                  <span>Standalone Studio</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>

              <form onSubmit={handleLaunchLinks} className="space-y-5">
                {/* Link Hub Codename */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-300">Linktree Hub Codename</label>
                    <button
                      type="button"
                      onClick={() => { sound.playClick?.(); setLinkId(generateNATORoomId()); }}
                      className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Dices className="w-3.5 h-3.5" />
                      <span>Randomize</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={linkId}
                    onChange={(e) => setLinkId(e.target.value.toUpperCase())}
                    className="w-full apple-frosted-input rounded-2xl px-4 py-3 text-base sm:text-sm font-mono font-bold text-white outline-none uppercase tracking-wider"
                    required
                  />
                </div>

                {/* Master Vault Passphrase */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-300">Master Editing Passphrase</label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(`Links: ${linkId}\nKey: ${linkPassphrase}`, setLinkCopied)}
                        className="text-xs font-semibold text-slate-400 hover:text-purple-400 flex items-center gap-1 cursor-pointer"
                      >
                        {linkCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{linkCopied ? 'Copied' : 'Copy Key'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { sound.playKey?.(); setLinkPassphrase(generateSecurePassphrase()); }}
                        className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Dices className="w-3.5 h-3.5" />
                        <span>Regenerate</span>
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type={linkShowPass ? 'text' : 'password'}
                      value={linkPassphrase}
                      onChange={(e) => setLinkPassphrase(e.target.value)}
                      className="w-full apple-frosted-input rounded-2xl px-4 py-3 text-base sm:text-sm font-mono text-white outline-none pr-11"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setLinkShowPass(!linkShowPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer p-1"
                    >
                      {linkShowPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 font-normal">
                    Required to edit or add links. Public visitors can view the Linktree without entering this password.
                  </p>
                </div>

                {/* Lifespan: Default ♾️ NO TIME LIMIT */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-300">Hub Lifespan</label>
                    <span className="text-[11px] font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30 flex items-center gap-1">
                      <InfinityIcon className="w-3 h-3" />
                      <span>Permanent by Default</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => { sound.playClick?.(); setLinkTtl('never'); }}
                      className={`py-2 px-1.5 sm:px-3 rounded-2xl text-[11px] sm:text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 ${
                        linkTtl === 'never'
                          ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-500/25'
                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                      }`}
                    >
                      <InfinityIcon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">No Limit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { sound.playClick?.(); setLinkTtl('24h'); }}
                      className={`py-2 px-1.5 sm:px-3 rounded-2xl text-[11px] sm:text-xs font-bold border transition-all cursor-pointer ${
                        linkTtl === '24h'
                          ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-500/25'
                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                      }`}
                    >
                      <span>24 Hours</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { sound.playClick?.(); setLinkTtl('6h'); }}
                      className={`py-2 px-1.5 sm:px-3 rounded-2xl text-[11px] sm:text-xs font-bold border transition-all cursor-pointer ${
                        linkTtl === '6h'
                          ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-500/25'
                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                      }`}
                    >
                      <span>6 Hours</span>
                    </button>
                  </div>
                </div>

                {/* Dynamic QR Toggle */}
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-3 p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 cursor-pointer hover:bg-purple-500/15 transition-colors">
                    <input
                      type="checkbox"
                      checked={linkDynamicQr}
                      onChange={(e) => setLinkDynamicQr(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 accent-purple-600 bg-slate-950 border-slate-700"
                    />
                    <div>
                      <p className="text-xs font-bold text-white flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 text-purple-400" />
                        <span>Generate Instant Dynamic QR Code</span>
                      </p>
                      <p className="text-[11px] text-slate-400">Auto-renders high-contrast printable QR code in SVG and PNG.</p>
                    </div>
                  </label>
                </div>

                {/* Launch Button */}
                <button
                  type="submit"
                  disabled={isDeploying}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-heading font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-purple-500/30 transition-all cursor-pointer tactile-btn disabled:opacity-50"
                >
                  {isDeploying ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{telemetryStage}</span>
                    </>
                  ) : (
                    <>
                      <span>Publish Smart Linktree Hub</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ── Universal Quick Key Unlocker (5 cols) - Dark Luxury Card ── */}
        <div className="lg:col-span-5 apple-frosted-glass apple-frosted-card rounded-3xl p-4 sm:p-8 shadow-2xl border border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3.5 pb-5 border-b border-white/10 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold shadow-xs">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-heading font-black text-white tracking-tight">
                  Universal Vault Unlocker
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Unlock any Drop, Chat, or Linktree instantly</p>
              </div>
            </div>

            <form onSubmit={handleUniversalJoin} className="space-y-4">
              {/* Target Type Selector */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Destination Module</label>
                <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
                  {(['auto', 'drop', 'chat', 'links'] as const).map((mod) => (
                    <button
                      key={mod}
                      type="button"
                      onClick={() => setJoinModule(mod)}
                      className={`py-1.5 px-1 sm:px-2 rounded-xl text-[10px] sm:text-[11px] font-bold border transition-all cursor-pointer ${
                        joinModule === mod
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                      }`}
                    >
                      {mod === 'auto' ? (
                        <>
                          <span className="sm:hidden">Auto</span>
                          <span className="hidden sm:inline">Auto-Detect</span>
                        </>
                      ) : mod === 'drop' ? 'Drop' : mod === 'chat' ? 'Chat' : 'Links'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Room Code or Full Link */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Room Code / Share Link</label>
                <input
                  type="text"
                  value={joinRoomId}
                  onChange={(e) => {
                    setJoinRoomId(e.target.value);
                    setJoinError('');
                  }}
                  placeholder="e.g. ALPHA-902 or paste full URL…"
                  className="w-full apple-frosted-input rounded-2xl px-4 py-3 text-base sm:text-sm text-white outline-none uppercase tracking-wider"
                  required
                />
              </div>

              {/* Decryption Password */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Secret Room Password</label>
                <input
                  type="password"
                  value={joinPassphrase}
                  onChange={(e) => {
                    setJoinPassphrase(e.target.value);
                    setJoinError('');
                  }}
                  placeholder="Enter secret decryption password…"
                  className="w-full apple-frosted-input rounded-2xl px-4 py-3 text-base sm:text-sm text-white outline-none"
                  required
                />
              </div>

              {joinError && (
                <p className="text-xs text-rose-400 font-semibold p-2.5 rounded-xl bg-rose-950/50 border border-rose-500/30">
                  {joinError}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 border border-white/15 text-white font-heading font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer tactile-btn"
              >
                <span>Unlock & Enter Room</span>
                <ArrowRight className="w-4 h-4 text-cyan-400" />
              </button>
            </form>
          </div>

          {/* Privacy & Zero-Knowledge Guarantee Note */}
          <div className="mt-8 pt-5 border-t border-white/10">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-white">Zero Logs & Ephemeral Keys</p>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                  Your password never touches any remote database. Cryptographic keys are derived in Web Crypto memory on your local machine.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── 4. Three Dedicated Architecture Pillars (Dark Luxury Grid) ── */}
      <div className="mb-8">
        <div className="text-center mb-10">
          <h3 className="text-2xl sm:text-3xl font-heading font-black text-white tracking-tight">
            Strict Feature Isolation
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-lg mx-auto">
            Zero cross-contamination. Each tool operates as an independent, single-purpose cryptographic suite.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Secret File Drop */}
          <div className="apple-frosted-glass apple-frosted-card rounded-3xl p-6 sm:p-7 shadow-xl border border-white/10 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold mb-4 shadow-xs">
                <HardDrive className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <h4 className="font-heading font-extrabold text-lg text-white">
                  Secret File Drop
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Zero Login
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Encrypted anonymous file sharing. Files self-destruct upon recipient download with zero disk persistence.
              </p>

              {/* Specs List */}
              <ul className="space-y-2 text-xs text-slate-300 font-medium mb-6">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span>AES-256-GCM chunked stream encryption</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span>Single-use Burn-on-Download</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span>Configurable TTL (15m to 24h)</span>
                </li>
              </ul>
            </div>

            <Link
              href="/drop"
              onClick={() => sound.playClick?.()}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 font-heading font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Open Drop Launcher</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card 2: Real-Time Ephemeral Chat */}
          <div className="apple-frosted-glass apple-frosted-card rounded-3xl p-6 sm:p-7 shadow-xl border border-white/10 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold mb-4 shadow-xs">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <h4 className="font-heading font-extrabold text-lg text-white">
                  Real-Time Chat
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Double Blue Ticks
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Distraction-free E2EE chat studio. Verified identity with Google Auth, read receipts, and screen-capture shield.
              </p>

              {/* Specs List */}
              <ul className="space-y-2 text-xs text-slate-300 font-medium mb-6">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Real-time read receipts with double ticks</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Privacy Guard & Screen capture alert</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Instant self-destruct when empty</span>
                </li>
              </ul>
            </div>

            <Link
              href="/chat"
              onClick={() => sound.playClick?.()}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-heading font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Open Chat Launcher</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card 3: Smart Linktree & Dynamic QR */}
          <div className="apple-frosted-glass apple-frosted-card rounded-3xl p-6 sm:p-7 shadow-xl border border-white/10 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold mb-4 shadow-xs">
                <QrCode className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <h4 className="font-heading font-extrabold text-lg text-white">
                  Smart Linktree & QR
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                  <InfinityIcon className="w-2.5 h-2.5" />
                  <span>No Time Limit</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Curate multi-link profiles with dynamic QR code generation, Google Cloud Sync, and permanent hosting.
              </p>

              {/* Specs List */}
              <ul className="space-y-2 text-xs text-slate-300 font-medium mb-6">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  <span>Permanent by default (No expiry)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  <span>Dynamic high-resolution QR export</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  <span>Google Cloud profile synchronization</span>
                </li>
              </ul>
            </div>

            <Link
              href="/links"
              onClick={() => sound.playClick?.()}
              className="w-full py-2.5 px-4 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 font-heading font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Open Linktree Launcher</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
