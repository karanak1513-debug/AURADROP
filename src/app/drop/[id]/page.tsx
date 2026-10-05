'use client';

import React, { useState, useEffect, useRef, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Lock,
  Key,
  ArrowRight,
  RefreshCw,
  HardDrive,
  Users,
  Eye,
  EyeOff,
  ShieldAlert,
  LogOut,
  Zap,
  Clock,
  Sparkles,
  Flame,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { DynamicAuraCanvas as AuraCanvas } from '@/components/canvas/DynamicAuraCanvas';
import { DeadDropVault } from '@/components/workspace/DeadDropVault';
import { SocialShareModal } from '@/components/workspace/SocialShareModal';
import { generateKeyFromPassphrase } from '@/lib/crypto';
import { ChatRoomMetadata } from '@/lib/chatStore';
import { VaultFileMetadata, Peer, PodMetadata } from '@/types/vault';
import { sound } from '@/lib/sound';

function formatCountdown(s: number): string {
  if (s <= 0) return '00:00';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function SecretDropModulePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const dropId = resolvedParams.id.toUpperCase();
  const router = useRouter();

  // ── Core State ────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<'loading' | 'enter_key' | 'inside' | 'destroyed' | 'not_found'>('loading');
  const [podMeta, setPodMeta] = useState<PodMetadata | null>(null);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [passphraseInput, setPassphraseInput] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [destroyReason, setDestroyReason] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);

  const [files, setFiles] = useState<VaultFileMetadata[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);

  const [currentPeer] = useState<Peer>(() => {
    const hex = Math.random().toString(16).substring(2, 6).toUpperCase();
    return {
      id: `peer-${Date.now()}-${hex}`,
      codename: `Drop-${hex}`,
      color: '#6366F1',
      joinedAt: Date.now(),
      lastPing: Date.now(),
      isCreator: false,
    };
  });

  const [isHost, setIsHost] = useState(false);
  const keyRef = useRef<CryptoKey | null>(null);

  // ── Fetch Files for Drop Vault (100% Open Access) ─────────────────────────
  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/pods/${encodeURIComponent(dropId)}/files`);
      if (res.ok) {
        const data = await res.json();
        if (data.files) setFiles(data.files);
      }
    } catch (err) {
      console.warn('[SecretDrop] Files fetch failed:', err);
    }
  }, [dropId]);

  // ── Initialize and extract key from hash ───────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const res = await fetch(`/api/pods/${encodeURIComponent(dropId)}`);
        if (!mounted) return;

        if (res.status === 404) {
          // Check if room metadata exists
          const roomRes = await fetch(`/api/rooms/${encodeURIComponent(dropId)}`);
          if (roomRes.ok) {
            const rData = await roomRes.json();
            const rMeta: ChatRoomMetadata = rData.room.metadata;
            const mockMeta: PodMetadata = {
              id: dropId,
              salt: rMeta.salt,
              createdAt: rMeta.createdAt,
              expiresAt: rMeta.expiresAt,
              ttlSeconds: rMeta.ttlSeconds,
              burnOnDownload: false,
              burnOnEmpty: false,
              readOnlyGuests: false,
              creatorPeerId: rMeta.hostPeerId,
              isZeroized: false,
            };
            setPodMeta(mockMeta);
            setSecondsLeft(Math.max(0, Math.floor((mockMeta.expiresAt - Date.now()) / 1000)));
            checkUrlKey(mockMeta, mounted);
            return;
          }

          setPhase('not_found');
          return;
        }

        if (!res.ok) throw new Error('Fetch failed');

        const data = await res.json();
        const podObj = data.pod || data.state;
        if (!podObj || !podObj.metadata) {
          throw new Error('Pod metadata missing from response');
        }
        const meta: PodMetadata = podObj.metadata;
        setPodMeta(meta);
        setSecondsLeft(Math.max(0, Math.floor((meta.expiresAt - Date.now()) / 1000)));
        setIsHost(meta.creatorPeerId === currentPeer.id);

        checkUrlKey(meta, mounted);
      } catch (err) {
        console.error('[SecretDrop] Init error:', err);
        if (mounted) setPhase('not_found');
      }
    };

    const checkUrlKey = async (meta: PodMetadata, isMounted: boolean) => {
      let extracted = '';
      if (typeof window !== 'undefined') {
        const hash = window.location.hash;
        const sp = new URLSearchParams(window.location.search);

        if (hash.startsWith('#key=')) {
          extracted = decodeURIComponent(hash.replace('#key=', ''));
        } else if (sp.has('key')) {
          extracted = sp.get('key') || '';
          window.history.replaceState(null, '', `${window.location.pathname}#key=${encodeURIComponent(extracted)}`);
        } else if (sp.has('k')) {
          extracted = sp.get('k') || '';
          window.history.replaceState(null, '', `${window.location.pathname}#key=${encodeURIComponent(extracted)}`);
        }
      }

      if (extracted) {
        await joinWithKey(extracted, meta, isMounted);
      } else {
        setPhase('enter_key');
      }
    };

    init();
    return () => {
      mounted = false;
    };
  }, [dropId]);

  // ── Derive crypto key and enter ───────────────────────────────────────────
  const joinWithKey = async (pass: string, meta: PodMetadata, isMounted: boolean = true) => {
    try {
      setIsJoining(true);
      setKeyError('');

      const key = await generateKeyFromPassphrase(pass, meta.salt);
      if (!isMounted) return;

      keyRef.current = key;
      setCryptoKey(key);
      setPassphrase(pass);

      if (typeof window !== 'undefined' && !window.location.hash.startsWith('#key=')) {
        window.history.replaceState(null, '', `${window.location.pathname}#key=${encodeURIComponent(pass)}`);
      }

      await fetchFiles();
      setPhase('inside');
      sound.playSuccess?.();
    } catch (err) {
      console.error('[SecretDrop] Key derivation failed:', err);
      if (isMounted) {
        setKeyError('Could not unlock with this password. Please verify.');
        setPhase('enter_key');
      }
    } finally {
      if (isMounted) setIsJoining(false);
    }
  };

  const handleKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphraseInput.trim() || !podMeta) return;
    await joinWithKey(passphraseInput.trim(), podMeta);
  };

  // ── Countdown Timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'inside' || secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setDestroyReason('LIFECYCLE_TTL_EXPIRED');
          setPhase('destroyed');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, secondsLeft]);

  const handlePanic = async () => {
    if (!confirm('EMERGENCY ZEROIZE: Permanently destroy all files and wipe this drop pod from memory?')) {
      return;
    }
    try {
      sound.playBurn?.();
      await fetch(`/api/pods/${encodeURIComponent(dropId)}`, { method: 'DELETE' });
    } catch {
      // Ignored
    } finally {
      setDestroyReason('EMERGENCY_MANUAL_ZEROIZE');
      setPhase('destroyed');
    }
  };

  const handleFileShredded = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    sound.playBurn?.();
  };

  // ── Destroyed Render ───────────────────────────────────────────────────────
  if (phase === 'destroyed') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-3xl bg-rose-100 border border-rose-200 flex items-center justify-center text-3xl mx-auto mb-4 shadow-md">
            💥
          </div>
          <h1 className="font-heading font-bold text-xl text-slate-900 mb-2">Drop Pod Destroyed</h1>
          <p className="text-xs text-slate-500 leading-relaxed mb-2">
            Reason: <code className="font-mono text-rose-600">{destroyReason}</code>
          </p>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            All file buffers have been zeroized and shredded from memory.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold text-xs shadow-md hover:opacity-95 transition-opacity cursor-pointer"
          >
            Create New Drop
          </button>
        </div>
      </div>
    );
  }

  // ── Not Found Render ──────────────────────────────────────────────────────
  if (phase === 'not_found') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-4 shadow-xs">
            <ShieldAlert className="w-8 h-8 text-slate-400" />
          </div>
          <h1 className="font-heading font-bold text-xl text-slate-900 mb-2">Drop Pod Not Found</h1>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            This pod has expired or was zeroized. All data has vanished from memory.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold text-xs shadow-md hover:opacity-95 transition-opacity cursor-pointer"
          >
            Create New Drop
          </button>
        </div>
      </div>
    );
  }

  // ── Loading Render ────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
          <p className="text-xs font-semibold text-indigo-600">Unlocking Secret Drop…</p>
        </div>
      </div>
    );
  }

  // ── Enter Key Render ──────────────────────────────────────────────────────
  if (phase === 'enter_key') {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#07090E] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden aura-ambient">
        <AuraCanvas />

        <div className="relative z-10 w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-indigo-500 to-cyan-500 p-[1.5px] mx-auto mb-4 shadow-xl shadow-indigo-500/30">
              <div className="w-full h-full bg-[#0D1222] rounded-3xl flex items-center justify-center text-2xl">
                📁
              </div>
            </div>
            <h1 className="font-heading font-black text-xl text-white tracking-tight">
              SECRET FILE DROP
            </h1>
            <p className="text-xs text-slate-400 mt-1">Burn-on-Download · Client-Side AES-256-GCM</p>
          </div>

          <div className="apple-frosted-glass border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Key className="w-4 h-4 text-indigo-400" />
              </div>
              <h2 className="font-heading font-bold text-sm text-white">Enter Pod Password</h2>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed mb-4 font-normal">
              Enter the secret password to decrypt file envelopes directly in your browser.
            </p>

            <form onSubmit={handleKeySubmit} className="space-y-3">
              <div className="relative">
                <input
                  type={showPassphrase ? 'text' : 'password'}
                  value={passphraseInput}
                  onChange={(e) => {
                    setPassphraseInput(e.target.value);
                    setKeyError('');
                  }}
                  placeholder="Enter drop password…"
                  autoFocus
                  required
                  className="w-full apple-frosted-input rounded-2xl px-4 py-3 text-base sm:text-sm text-white outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassphrase(!showPassphrase)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {keyError && (
                <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  {keyError}
                </p>
              )}

              <button
                type="submit"
                disabled={isJoining || !passphraseInput.trim()}
                className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer tactile-btn"
              >
                {isJoining ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Decrypting…
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    Unlock Secret Drop
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>

          <button
            onClick={() => router.push('/')}
            className="mt-4 w-full py-2 text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ── Inside Dedicated File Drop Module (Zero Clutter, Zero Tabs) ─────────────
  if (phase === 'inside' && cryptoKey && podMeta) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#07090E] text-slate-100 flex flex-col aura-ambient relative overflow-x-hidden">
        {/* 3D Refractive WebGL Canvas */}
        <AuraCanvas />

        {/* Top Navbar — Secret Drop Module */}
        <Navbar
          podId={dropId}
          passphrase={passphrase}
          isZeroized={false}
          onPurge={handlePanic}
          onOpenShare={() => setShowShareModal(true)}
        />

        {/* Main Dedicated Content */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5 relative z-10 flex flex-col">
          {/* Header Sub-bar (100% Mobile Responsive) */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 px-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5 shadow-xs">
                <HardDrive className="w-3 h-3 text-indigo-400 shrink-0" />
                <span>Secret File Drop</span>
              </span>
              <span className="text-[10px] px-2 py-1 rounded-full font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                100% Anonymous
              </span>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-white/5 px-2.5 sm:px-3 py-1 rounded-full border border-white/10 shadow-xs">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-mono font-bold text-white tabular-nums">{formatCountdown(secondsLeft)}</span>
              </div>
            </div>
          </div>

          {/* Full-Canvas Dedicated DeadDropVault */}
          <div className="w-full">
            <DeadDropVault
              podId={dropId}
              cryptoKey={cryptoKey}
              files={files}
              currentPeer={currentPeer}
              isReadOnly={false}
              onFileUploaded={fetchFiles}
              onFileShredded={handleFileShredded}
            />
          </div>
        </main>

        {/* 1-Tap Social Share Modal */}
        {showShareModal && (
          <SocialShareModal
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            metadata={podMeta}
            passphrase={passphrase}
            secondsRemaining={secondsLeft}
          />
        )}
      </div>
    );
  }

  return null;
}
