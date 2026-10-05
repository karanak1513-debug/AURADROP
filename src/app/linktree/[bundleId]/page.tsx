'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Lock,
  Key,
  ArrowRight,
  RefreshCw,
  QrCode,
  Eye,
  EyeOff,
  ShieldAlert,
  LogOut,
  Clock,
  Sparkles,
  X,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { DynamicAuraCanvas as AuraCanvas } from '@/components/canvas/DynamicAuraCanvas';
import { SmartLinktreeVault } from '@/components/workspace/SmartLinktreeVault';
import { SocialShareModal } from '@/components/workspace/SocialShareModal';
import { generateKeyFromPassphrase, generateDeterministicSalt } from '@/lib/crypto';
import { LinkBundleProfile, Peer, PodMetadata } from '@/types/vault';
import { sound } from '@/lib/sound';
import {
  getLinktreeBundleRecord,
  saveLinktreeBundleRecord,
  subscribeToLinktreeBundle,
  FirestoreLinktreeBundle,
} from '@/lib/rooms';

function formatCountdown(s: number): string {
  if (s <= 0) return '00:00';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

const STARTER_LINKS: LinkBundleProfile = {
  title: 'Link Hub',
  bio: 'Self-destructing links. Private, zero-log & client-side encrypted.',
  customName: 'Curated by AuraDrop',
  avatarIcon: 'monogram',
  themeColor: '#6366F1',
  qrColor: '#0F172A',
  links: [
    {
      id: 'link-starter-1',
      title: 'Project Documentation & Assets',
      url: 'https://auradrop.io',
      category: 'website',
      description: 'Official AuraDrop documentation, specs and architecture overview.',
      tag: 'DOCS',
      clicks: 12,
      addedBy: 'AuraDrop',
      addedAt: Date.now() - 60000,
    },
    {
      id: 'link-starter-2',
      title: 'GitHub Source Repository',
      url: 'https://github.com/karanak1513-debug/AURADROP',
      category: 'github',
      description: 'Full source repository, release binaries and issues tracker.',
      tag: 'CODE',
      clicks: 8,
      addedBy: 'AuraDrop',
      addedAt: Date.now() - 30000,
    },
  ],
};

export default function LinktreeReceiverPage({ params }: { params: Promise<{ bundleId: string }> }) {
  const resolvedParams = use(params);
  const bundleId = resolvedParams.bundleId.toUpperCase();
  const router = useRouter();

  // ── Core State ────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<'loading' | 'inside' | 'expired' | 'not_found'>('loading');
  const [podMeta, setPodMeta] = useState<PodMetadata | null>(null);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [passphraseInput, setPassphraseInput] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const [linkBundle, setLinkBundle] = useState<LinkBundleProfile | undefined>(undefined);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  const [currentPeer] = useState<Peer>(() => {
    const hex = Math.random().toString(16).substring(2, 6).toUpperCase();
    return {
      id: `peer-${Date.now()}-${hex}`,
      codename: `Curator-${hex}`,
      color: '#8B5CF6',
      joinedAt: Date.now(),
      lastPing: Date.now(),
      isCreator: false,
    };
  });

  const keyRef = useRef<CryptoKey | null>(null);

  // ── Initialize and Subscribe to Firestore Record ──────────────────────────
  useEffect(() => {
    let mounted = true;
    let unsubFirestore: (() => void) | null = null;

    const init = async () => {
      try {
        // Extract key from hash or query if available
        let extracted = '';
        if (typeof window !== 'undefined') {
          const hash = window.location.hash;
          const sp = new URLSearchParams(window.location.search);

          if (hash.startsWith('#key=')) {
            extracted = decodeURIComponent(hash.replace('#key=', ''));
          } else if (hash.startsWith('#') && hash.length > 1) {
            const raw = hash.slice(1);
            if (!raw.includes('/')) extracted = decodeURIComponent(raw);
          } else if (sp.has('key')) {
            extracted = sp.get('key') || '';
          }
        }

        // 1. Fetch Authoritative Record from Firestore
        let fsData = await getLinktreeBundleRecord(bundleId);

        // 2. Race condition protection: wait 2s if creator just created it
        if (!fsData) {
          await new Promise((r) => setTimeout(r, 2000));
          if (!mounted) return;
          fsData = await getLinktreeBundleRecord(bundleId);
        }

        // 3. Fallback: Query /api/pods/[id]
        if (!fsData) {
          try {
            const res = await fetch(`/api/pods/${encodeURIComponent(bundleId)}`);
            if (res.ok) {
              const data = await res.json();
              const p = data.pod || data.state;
              if (p?.linkBundle) {
                fsData = {
                  bundleId,
                  title: p.linkBundle.title || `${bundleId} Link Hub`,
                  links: p.linkBundle.links || [],
                  theme: p.linkBundle.themeColor || 'indigo',
                  createdAt: p.metadata?.createdAt || Date.now(),
                  expiresAt: p.metadata?.expiresAt || 0,
                  hostEmail: 'anonymous',
                  status: 'ACTIVE',
                  bio: p.linkBundle.bio,
                  customName: p.linkBundle.customName,
                  avatarIcon: p.linkBundle.avatarIcon,
                  themeColor: p.linkBundle.themeColor,
                  qrColor: p.linkBundle.qrColor,
                };
              }
            }
          } catch {
            // ignore
          }
        }

        // Expiry check
        if (fsData && fsData.expiresAt > 0 && Date.now() > fsData.expiresAt) {
          if (mounted) setPhase('expired');
          return;
        }

        // Form bundle profile
        const resolvedBundle: LinkBundleProfile = {
          title: fsData?.title || `${bundleId} Link Hub`,
          bio: fsData?.bio || 'Self-destructing links. Private, zero-log & client-side encrypted.',
          customName: fsData?.customName || 'Curated with AuraDrop',
          avatarIcon: (fsData?.avatarIcon as any) || 'monogram',
          themeColor: fsData?.themeColor || '#6366F1',
          qrColor: fsData?.qrColor || '#0F172A',
          links: fsData?.links && fsData.links.length > 0 ? fsData.links : STARTER_LINKS.links,
        };

        const fallbackSalt = generateDeterministicSalt(bundleId);
        const meta: PodMetadata = {
          id: bundleId,
          salt: fallbackSalt,
          createdAt: fsData?.createdAt || Date.now(),
          expiresAt: fsData?.expiresAt || 0,
          ttlSeconds: fsData?.expiresAt ? Math.floor((fsData.expiresAt - (fsData.createdAt || Date.now())) / 1000) : 0,
          burnOnDownload: false,
          burnOnEmpty: false,
          readOnlyGuests: false,
          creatorPeerId: 'OPERATOR',
          isZeroized: false,
        };

        setPodMeta(meta);
        setLinkBundle(resolvedBundle);
        const isNoLimit = meta.expiresAt === 0 || meta.ttlSeconds === 0;
        setSecondsLeft(isNoLimit ? 0 : Math.max(0, Math.floor((meta.expiresAt - Date.now()) / 1000)));

        // Realtime Firestore subscription
        unsubFirestore = subscribeToLinktreeBundle(bundleId, (updated) => {
          if (!mounted) return;
          if (!updated) return;
          if (updated.expiresAt > 0 && Date.now() > updated.expiresAt) {
            setPhase('expired');
            return;
          }
          if (updated.links && Array.isArray(updated.links)) {
            setLinkBundle((prev) => ({
              ...prev,
              title: updated.title || prev?.title || `${bundleId} Link Hub`,
              bio: updated.bio || prev?.bio || '',
              customName: updated.customName || prev?.customName,
              avatarIcon: (updated.avatarIcon as any) || prev?.avatarIcon,
              themeColor: updated.themeColor || prev?.themeColor || '#6366F1',
              qrColor: updated.qrColor || prev?.qrColor || '#0F172A',
              links: updated.links,
            }));
          }
        });

        // If passphrase present, derive key
        if (extracted) {
          const key = await generateKeyFromPassphrase(extracted, fallbackSalt);
          if (mounted) {
            keyRef.current = key;
            setCryptoKey(key);
            setPassphrase(extracted);
          }
        }

        // Enter inside directly so all links are immediately visible
        if (mounted) {
          setPhase('inside');
        }
      } catch (err) {
        console.error('[LinktreeReceiver] Init error:', err);
        if (mounted) {
          // Provide fallback rather than blank error
          setLinkBundle({
            ...STARTER_LINKS,
            title: `${bundleId} Link Hub`,
          });
          setPodMeta({
            id: bundleId,
            salt: generateDeterministicSalt(bundleId),
            createdAt: Date.now(),
            expiresAt: 0,
            ttlSeconds: 0,
            burnOnDownload: false,
            burnOnEmpty: false,
            readOnlyGuests: false,
            creatorPeerId: 'OPERATOR',
            isZeroized: false,
          });
          setPhase('inside');
        }
      }
    };

    init();
    return () => {
      mounted = false;
      unsubFirestore?.();
    };
  }, [bundleId]);

  const joinWithKey = async (pass: string, meta: PodMetadata, isMounted: boolean = true) => {
    try {
      setIsJoining(true);
      setKeyError('');
      const key = await generateKeyFromPassphrase(pass, meta.salt);
      if (!isMounted) return;

      keyRef.current = key;
      setCryptoKey(key);
      setPassphrase(pass);
      setShowUnlockModal(false);

      if (typeof window !== 'undefined' && !window.location.hash.startsWith('#key=')) {
        window.history.replaceState(null, '', `${window.location.pathname}#key=${encodeURIComponent(pass)}`);
      }
      sound.playSuccess?.();
    } catch {
      if (isMounted) setKeyError('Invalid password. Please verify.');
    } finally {
      if (isMounted) setIsJoining(false);
    }
  };

  const handleKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphraseInput.trim() || !podMeta) return;
    await joinWithKey(passphraseInput.trim(), podMeta);
  };

  const handleUpdateLinkBundle = async (updated: LinkBundleProfile) => {
    setLinkBundle(updated);
    try {
      await saveLinktreeBundleRecord(
        bundleId,
        updated.title,
        updated.links,
        updated.themeColor || 'indigo',
        24,
        'anonymous',
        {
          bio: updated.bio,
          customName: updated.customName,
          avatarIcon: updated.avatarIcon,
          themeColor: updated.themeColor,
          qrColor: updated.qrColor,
        }
      );
      await fetch(`/api/pods/${encodeURIComponent(bundleId)}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundle: updated, peerCodename: currentPeer.codename }),
      });
    } catch (err) {
      console.warn('[LinktreeReceiver] Persist bundle error:', err);
    }
  };

  const handleLinkClick = async (clickLinkId: string) => {
    try {
      await fetch(`/api/pods/${encodeURIComponent(bundleId)}/links`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId: clickLinkId }),
      });
    } catch (err) {
      console.warn('[LinktreeReceiver] Click record error:', err);
    }
  };

  // ── Expired Render ────────────────────────────────────────────────────────
  if (phase === 'expired') {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#07090E] text-slate-100 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden aura-ambient">
        <AuraCanvas />
        <div className="relative z-10 max-w-md w-full text-center apple-frosted-glass rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg shadow-rose-500/20">
            ⏳
          </div>
          <h1 className="font-heading font-black text-xl text-white mb-2">Link Hub Expired</h1>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            This ephemeral link hub has reached its expiration time limit and was zeroized.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 hover:opacity-95 transition-opacity cursor-pointer tactile-btn"
          >
            Create New Hub
          </button>
        </div>
      </div>
    );
  }

  // ── Loading Render ────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#07090E] flex items-center justify-center p-4 relative overflow-hidden aura-ambient">
        <AuraCanvas />
        <div className="relative z-10 flex flex-col items-center gap-3 apple-frosted-glass p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl max-w-xs w-full text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
          </div>
          <p className="text-xs font-bold text-white tracking-wide">Loading Smart Linktree…</p>
          <p className="text-[11px] text-slate-400 font-normal">
            Fetching verified bio-links & real-time analytics…
          </p>
        </div>
      </div>
    );
  }

  const isNoTimeLimit = !podMeta || podMeta.expiresAt === 0 || podMeta.ttlSeconds === 0;

  // ── Inside Render (Direct Public Hub View) ─────────────────────────────────
  if (phase === 'inside' && podMeta) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#07090E] text-slate-100 flex flex-col aura-ambient relative overflow-x-hidden">
        <AuraCanvas />
        <Navbar
          podId={bundleId}
          passphrase={passphrase}
          isZeroized={false}
          onOpenShare={() => setShowShareModal(true)}
        />

        <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5 relative z-10 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 px-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1.5 shadow-xs">
                <QrCode className="w-3 h-3 text-purple-400 shrink-0" />
                <span>Smart Linktree & Dynamic QR</span>
              </span>
              {!cryptoKey ? (
                <span className="text-[10px] px-2 py-1 rounded-full font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Public Hub
                </span>
              ) : (
                <span className="text-[10px] px-2 py-1 rounded-full font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  Creator Mode
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-white/5 px-2.5 sm:px-3 py-1 rounded-full border border-white/10 shadow-xs">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-mono font-bold text-white tabular-nums">
                  {isNoTimeLimit ? 'Permanent' : formatCountdown(secondsLeft)}
                </span>
              </div>
            </div>
          </div>

          <div className="w-full">
            <SmartLinktreeVault
              podId={bundleId}
              passphrase={passphrase}
              initialBundle={linkBundle}
              currentPeer={currentPeer}
              isReadOnly={!cryptoKey}
              onPromptUnlock={() => setShowUnlockModal(true)}
              onUpdateBundle={handleUpdateLinkBundle}
              onLinkClick={handleLinkClick}
              secondsRemaining={isNoTimeLimit ? 0 : secondsLeft}
              onOpenShare={() => setShowShareModal(true)}
            />
          </div>
        </main>

        {showShareModal && (
          <SocialShareModal
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            metadata={podMeta}
            passphrase={passphrase}
            secondsRemaining={isNoTimeLimit ? 0 : secondsLeft}
          />
        )}

        {showUnlockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-sm apple-frosted-glass rounded-3xl p-6 border border-white/10 shadow-2xl">
              <button
                type="button"
                onClick={() => setShowUnlockModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-white">Unlock Creator Studio</h3>
                  <p className="text-[11px] text-slate-400">Enter password to edit or customize links</p>
                </div>
              </div>

              <form onSubmit={handleKeySubmit} className="space-y-3 mt-4">
                <div className="relative">
                  <input
                    type={showPassphrase ? 'text' : 'password'}
                    value={passphraseInput}
                    onChange={(e) => {
                      setPassphraseInput(e.target.value);
                      setKeyError('');
                    }}
                    placeholder="Enter hub password…"
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

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowUnlockModal(false)}
                    className="flex-1 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Keep Viewing
                  </button>
                  <button
                    type="submit"
                    disabled={isJoining || !passphraseInput.trim()}
                    className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/30 disabled:opacity-50 transition-all cursor-pointer tactile-btn"
                  >
                    {isJoining ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Checking…</span>
                      </>
                    ) : (
                      <>
                        <Key className="w-3.5 h-3.5" />
                        <span>Unlock Studio</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
