'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Lock,
  Key,
  ArrowRight,
  RefreshCw,
  MessageSquare,
  Users,
  Eye,
  EyeOff,
  ShieldAlert,
  LogOut,
  Zap,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { DynamicAuraCanvas as AuraCanvas } from '@/components/canvas/DynamicAuraCanvas';
import { AuraChatRoom, AVATAR_EMOJIS } from '@/components/chat/AuraChatRoom';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { SocialShareModal } from '@/components/workspace/SocialShareModal';
import { generateKeyFromPassphrase } from '@/lib/crypto';
import { ChatMember, ChatRoomMetadata } from '@/lib/chatStore';
import { PodMetadata } from '@/types/vault';
import { sound } from '@/lib/sound';

const PEER_COLORS = [
  '#6366F1', '#06B6D4', '#A855F7', '#10B981',
  '#F59E0B', '#F43F5E', '#8B5CF6', '#EC4899',
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatCountdown(s: number): string {
  if (s <= 0) return '00:00';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function RealtimeChatModulePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const roomId = resolvedParams.id.toUpperCase();
  const router = useRouter();

  // ── Core State ────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<'loading' | 'enter_key' | 'inside' | 'destroyed' | 'not_found'>('loading');
  const [roomMeta, setRoomMeta] = useState<ChatRoomMetadata | null>(null);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [passphraseInput, setPassphraseInput] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [destroyReason, setDestroyReason] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);

  const [showShareModal, setShowShareModal] = useState(false);

  const [currentMember] = useState<ChatMember>(() => {
    const hex = Math.random().toString(16).substring(2, 6).toUpperCase();
    return {
      id: `peer-${Date.now()}-${hex}`,
      codename: `Ghost-${hex}`,
      color: randomItem(PEER_COLORS),
      avatarEmoji: randomItem(AVATAR_EMOJIS),
      joinedAt: Date.now(),
      lastPing: Date.now(),
      isHost: false,
      isTyping: false,
    };
  });

  const [isHost, setIsHost] = useState(false);
  const keyRef = useRef<CryptoKey | null>(null);

  // ── Initialize and extract key from hash ───────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`);
        if (!mounted) return;

        if (res.status === 404) {
          setPhase('not_found');
          return;
        }
        if (!res.ok) throw new Error('Fetch failed');

        const data = await res.json();
        const meta: ChatRoomMetadata = data.room.metadata;
        setRoomMeta(meta);
        setSecondsLeft(Math.max(0, Math.floor((meta.expiresAt - Date.now()) / 1000)));
        setIsHost(meta.hostPeerId === currentMember.id);

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
          await joinWithKey(extracted, meta, mounted);
        } else {
          setPhase('enter_key');
        }
      } catch (err) {
        console.error('[RealtimeChat] Init error:', err);
        if (mounted) setPhase('not_found');
      }
    };

    init();
    return () => {
      mounted = false;
    };
  }, [roomId]);

  // ── Derive crypto key and enter ───────────────────────────────────────────
  const joinWithKey = async (pass: string, meta: ChatRoomMetadata, isMounted: boolean = true) => {
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

      setPhase('inside');
      sound.playSuccess?.();
    } catch (err) {
      console.error('[RealtimeChat] Key derivation failed:', err);
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
    if (!passphraseInput.trim() || !roomMeta) return;
    await joinWithKey(passphraseInput.trim(), roomMeta);
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
    if (!confirm('EMERGENCY ZEROIZE: Permanently purge all messages and destroy this chatroom?')) {
      return;
    }
    try {
      sound.playBurn?.();
      await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, { method: 'DELETE' });
    } catch {
      // Ignored
    } finally {
      setDestroyReason('EMERGENCY_MANUAL_ZEROIZE');
      setPhase('destroyed');
    }
  };

  const handleLeave = () => {
    sound.playClick?.();
    router.push('/');
  };

  // ── Destroyed Render ──────────────────────────────────────────────────────
  if (phase === 'destroyed') {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#07090E] text-slate-100 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden aura-ambient">
        <AuraCanvas />
        <div className="relative z-10 max-w-md w-full text-center apple-frosted-glass rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg shadow-rose-500/20">
            💥
          </div>
          <h1 className="font-heading font-black text-xl text-white mb-2">Chatroom Destroyed</h1>
          <p className="text-xs text-slate-400 leading-relaxed mb-2">
            Reason: <code className="font-mono text-rose-400 font-bold">{destroyReason}</code>
          </p>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            All cryptographic keys and message buffers have been overwritten with zeros.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 hover:opacity-95 transition-opacity cursor-pointer tactile-btn"
          >
            Create New Room
          </button>
        </div>
      </div>
    );
  }

  // ── Not Found Render ──────────────────────────────────────────────────────
  if (phase === 'not_found') {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#07090E] text-slate-100 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden aura-ambient">
        <AuraCanvas />
        <div className="relative z-10 max-w-md w-full text-center apple-frosted-glass rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl">
          <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 shadow-xs">
            <ShieldAlert className="w-8 h-8 text-slate-400" />
          </div>
          <h1 className="font-heading font-black text-xl text-white mb-2">Chatroom Not Found</h1>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            This chatroom has expired or never existed. Zero trace remains.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 hover:opacity-95 transition-opacity cursor-pointer tactile-btn"
          >
            Create New Chat
          </button>
        </div>
      </div>
    );
  }

  // ── Loading Render ────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#07090E] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
          <p className="text-xs font-semibold text-indigo-300">Connecting to encrypted chat…</p>
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
                💬
              </div>
            </div>
            <h1 className="font-heading font-black text-xl text-white tracking-tight">
              AURA REAL-TIME CHAT
            </h1>
            <p className="text-xs text-slate-400 mt-1">End-to-End Encrypted · Double Blue Ticks</p>
          </div>

          <div className="apple-frosted-glass border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Key className="w-4 h-4 text-indigo-400" />
              </div>
              <h2 className="font-heading font-bold text-sm text-white">Enter Chat Password</h2>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed mb-4 font-normal">
              Your password derives client-side keys. Messages are decrypted only inside your browser memory.
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
                  placeholder="Enter chat password…"
                  autoFocus
                  required
                  className="w-full apple-frosted-input rounded-2xl px-4 py-2.5 text-xs text-white outline-none pr-10"
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
                    Connecting…
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    Unlock Chatroom
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

  // ── Inside Dedicated Ephemeral Chat Module ─────────────────────────────────
  if (phase === 'inside' && cryptoKey && roomMeta) {
    const mockPodMeta: PodMetadata = {
      id: roomId,
      salt: roomMeta.salt,
      createdAt: roomMeta.createdAt,
      expiresAt: roomMeta.expiresAt,
      ttlSeconds: roomMeta.ttlSeconds,
      burnOnDownload: false,
      burnOnEmpty: false,
      readOnlyGuests: false,
      creatorPeerId: roomMeta.hostPeerId,
      isZeroized: false,
    };

    return (
      <div className="h-screen h-[100dvh] max-h-[100dvh] w-full bg-[#07090E] text-slate-100 flex flex-col overflow-hidden relative">
        <AuthGuard
          featureName="Real-Time Ephemeral Chat"
          headline="Sign in with Google to enter Chat"
          subtext="Google authentication ensures verified identity and protects your zero-knowledge encrypted messaging stream."
        >
          <div className="w-full h-full flex flex-col overflow-hidden">
            <AuraChatRoom
              roomId={roomId}
              salt={roomMeta.salt}
              cryptoKey={cryptoKey}
              passphrase={passphrase}
              currentMember={{
                ...currentMember,
                isHost,
              }}
              onLeave={handleLeave}
              onPanic={handlePanic}
              isHost={isHost}
              expiresAt={roomMeta.expiresAt}
            />
          </div>
        </AuthGuard>

        {/* 1-Tap Social Share Modal */}
        {showShareModal && (
          <SocialShareModal
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            metadata={mockPodMeta}
            passphrase={passphrase}
            secondsRemaining={secondsLeft}
          />
        )}
      </div>
    );
  }

  return null;
}
