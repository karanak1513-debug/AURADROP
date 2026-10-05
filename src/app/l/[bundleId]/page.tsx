'use client';

import React, { useState, useEffect, use } from 'react';
import {
  Sparkles,
  Shield,
  Lock,
  Globe,
  Clock,
  ExternalLink,
  ChevronRight,
  Share2,
  Check,
  FileText,
  Music,
  Video,
  Send,
  MessageSquare,
  Palette,
  Code2,
} from 'lucide-react';
import { sound } from '@/lib/sound';
import { DynamicAuraCanvas as AuraCanvas } from '@/components/canvas/DynamicAuraCanvas';
import {
  getLinktreeBundleRecord,
  subscribeToLinktreeBundle,
} from '@/lib/rooms';
import { EphemeralLink, LinkBundleProfile } from '@/types/vault';

// ── Smart Brand SVG Icons ──────────────────────────────────────────────────────

function GithubIcon({ className = 'w-5 h-5 text-white' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  );
}

function TwitterIcon({ className = 'w-5 h-5 text-sky-400' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function InstagramIcon({ className = 'w-5 h-5 text-pink-400' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function LinkedinIcon({ className = 'w-5 h-5 text-blue-400' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function YoutubeIcon({ className = 'w-5 h-5 text-red-500' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

// ── Smart Brand Favicon & Icon Detector ────────────────────────────────────────

function extractDomain(rawUrl: string): string {
  try {
    const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function BrandIcon({ url, category }: { url: string; category?: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const domain = extractDomain(url).toLowerCase();

  // Social / Brand Icon overrides
  if (domain.includes('github.com')) {
    return <GithubIcon />;
  }
  if (domain.includes('twitter.com') || domain.includes('x.com')) {
    return <TwitterIcon />;
  }
  if (domain.includes('instagram.com')) {
    return <InstagramIcon />;
  }
  if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
    return <YoutubeIcon />;
  }
  if (domain.includes('linkedin.com')) {
    return <LinkedinIcon />;
  }
  if (domain.includes('spotify.com')) {
    return <Music className="w-5 h-5 text-emerald-400" />;
  }
  if (domain.includes('discord.com') || domain.includes('discord.gg')) {
    return <MessageSquare className="w-5 h-5 text-indigo-400" />;
  }
  if (domain.includes('t.me') || domain.includes('telegram.org')) {
    return <Send className="w-5 h-5 text-sky-400" />;
  }
  if (domain.includes('figma.com')) {
    return <Palette className="w-5 h-5 text-purple-400" />;
  }

  // Google Favicon service with seamless fallback
  if (domain && !imgFailed) {
    return (
      <img
        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
        alt=""
        className="w-5 h-5 rounded-md object-contain"
        onError={() => setImgFailed(true)}
      />
    );
  }

  // Category fallback
  switch (category) {
    case 'github':
      return <GithubIcon />;
    case 'figma':
      return <Palette className="w-5 h-5 text-purple-400" />;
    case 'document':
      return <FileText className="w-5 h-5 text-amber-400" />;
    case 'media':
      return <Video className="w-5 h-5 text-emerald-400" />;
    case 'social':
      return <Share2 className="w-5 h-5 text-indigo-400" />;
    default:
      return <Globe className="w-5 h-5 text-indigo-400" />;
  }
}

// ── Default Fallback Starter Links ───────────────────────────────────────────

const STARTER_LINKS: EphemeralLink[] = [
  {
    id: 'starter-1',
    title: 'Project Documentation & Specs',
    url: 'https://auradrop.io',
    category: 'website',
    description: 'Official AuraDrop documentation and architecture.',
    tag: 'DOCS',
    clicks: 14,
    addedBy: 'AuraDrop',
    addedAt: Date.now() - 60000,
  },
  {
    id: 'starter-2',
    title: 'Source Code Repository',
    url: 'https://github.com/karanak1513-debug/AURADROP',
    category: 'github',
    description: 'Open source repository & issue tracker.',
    tag: 'CODE',
    clicks: 9,
    addedBy: 'AuraDrop',
    addedAt: Date.now() - 30000,
  },
];

function formatCountdown(totalSec: number): string {
  if (totalSec <= 0) return '00:00';
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h}h ${String(remM).padStart(2, '0')}m`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function PublicLinktreeRecipientPage({
  params,
}: {
  params: Promise<{ bundleId: string }>;
}) {
  const resolvedParams = use(params);
  const bundleId = resolvedParams.bundleId.toUpperCase();

  const [isLoading, setIsLoading] = useState(true);
  const [isExpired, setIsExpired] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [copiedShare, setCopiedShare] = useState(false);

  const [bundle, setBundle] = useState<LinkBundleProfile>({
    title: bundleId,
    bio: 'Self-destructing links. Private & ephemeral.',
    customName: '',
    avatarIcon: 'sparkles',
    themeColor: '#6366F1',
    qrColor: '#0F172A',
    links: [],
  });

  const [expiresAt, setExpiresAt] = useState<number>(0);

  // ── Fetch & Real-time Sync ──────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    let unsubFirestore: (() => void) | null = null;

    const loadData = async () => {
      try {
        setIsLoading(true);

        // 1. Authoritative Firestore Handshake Document
        let record = await getLinktreeBundleRecord(bundleId);

        // 2. Fallback: Query /api/pods/[id]
        if (!record) {
          try {
            const res = await fetch(`/api/pods/${encodeURIComponent(bundleId)}`);
            if (res.ok) {
              const data = await res.json();
              const p = data.pod || data.state;
              if (p?.linkBundle) {
                record = {
                  bundleId,
                  title: p.linkBundle.title || bundleId,
                  bio: p.linkBundle.bio || 'Self-destructing links. Private & ephemeral.',
                  customName: p.linkBundle.customName || '',
                  avatarIcon: p.linkBundle.avatarIcon || 'sparkles',
                  themeColor: p.linkBundle.themeColor || '#6366F1',
                  qrColor: p.linkBundle.qrColor || '#0F172A',
                  links: p.linkBundle.links || [],
                  theme: p.linkBundle.themeColor || 'indigo',
                  createdAt: p.metadata?.createdAt || Date.now(),
                  expiresAt: p.metadata?.expiresAt || 0,
                  hostEmail: 'anonymous',
                  status: 'ACTIVE',
                };
              }
            }
          } catch {
            // ignore network failure
          }
        }

        if (!mounted) return;

        // Apply loaded data or smart starter
        if (record) {
          setExpiresAt(record.expiresAt || 0);

          // Check if expired
          if (record.expiresAt > 0 && Date.now() > record.expiresAt) {
            setIsExpired(true);
            setIsLoading(false);
            return;
          }

          setBundle({
            title: record.title || bundleId,
            bio: record.bio || 'Self-destructing links. Private & ephemeral.',
            customName: record.customName || '',
            avatarIcon: record.avatarIcon || 'sparkles',
            themeColor: record.themeColor || '#6366F1',
            qrColor: record.qrColor || '#0F172A',
            links: Array.isArray(record.links) && record.links.length > 0 ? record.links : STARTER_LINKS,
          });
        } else {
          // Zero-knowledge fallback starter so recipient never sees a 404 dead end
          setBundle({
            title: bundleId,
            bio: 'Self-destructing links. Private & ephemeral.',
            customName: '',
            avatarIcon: 'sparkles',
            themeColor: '#6366F1',
            qrColor: '#0F172A',
            links: STARTER_LINKS,
          });
        }

        setIsLoading(false);

        // 3. Real-time Firestore Live Sync
        unsubFirestore = subscribeToLinktreeBundle(bundleId, (liveRecord) => {
          if (!liveRecord || !mounted) return;
          if (liveRecord.status === 'EXPIRED' || (liveRecord.expiresAt > 0 && Date.now() > liveRecord.expiresAt)) {
            setIsExpired(true);
            return;
          }
          setExpiresAt(liveRecord.expiresAt || 0);
          setBundle((prev) => ({
            ...prev,
            title: liveRecord.title || prev.title,
            bio: liveRecord.bio !== undefined ? liveRecord.bio : prev.bio,
            customName: liveRecord.customName !== undefined ? liveRecord.customName : prev.customName,
            avatarIcon: liveRecord.avatarIcon || prev.avatarIcon,
            themeColor: liveRecord.themeColor || prev.themeColor,
            qrColor: liveRecord.qrColor || prev.qrColor,
            links: Array.isArray(liveRecord.links) && liveRecord.links.length > 0 ? liveRecord.links : prev.links,
          }));
        });
      } catch (err) {
        console.warn('[PublicLinktree] Init warning:', err);
        if (mounted) setIsLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
      if (unsubFirestore) unsubFirestore();
    };
  }, [bundleId]);

  // ── TTL Countdown Timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (expiresAt === 0) {
      setSecondsRemaining(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setSecondsRemaining(diff);
      if (diff <= 0) {
        setIsExpired(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // ── Click Action Handler ────────────────────────────────────────────────────
  const handleLinkClick = (link: EphemeralLink) => {
    sound.playClick();

    // Increment click counter asynchronously in background
    fetch(`/api/pods/${encodeURIComponent(bundleId)}/links`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'click', linkId: link.id }),
    }).catch(() => null);

    // Update local click state
    setBundle((prev) => ({
      ...prev,
      links: prev.links.map((l) => (l.id === link.id ? { ...l, clicks: (l.clicks || 0) + 1 } : l)),
    }));

    // Open target URL securely in new tab
    let dest = link.url.trim();
    if (!/^https?:\/\//i.test(dest)) {
      dest = `https://${dest}`;
    }
    window.open(dest, '_blank', 'noopener,noreferrer');
  };

  const handleShare = () => {
    sound.playClick();
    if (typeof window !== 'undefined') {
      const shareUrl = window.location.href;
      if (navigator.share) {
        navigator.share({
          title: bundle.title || bundleId,
          text: `Check out ${bundle.title || bundleId} on AuraDrop`,
          url: shareUrl,
        }).catch(() => null);
      } else {
        navigator.clipboard.writeText(shareUrl);
        setCopiedShare(true);
        setTimeout(() => setCopiedShare(false), 2000);
      }
    }
  };

  const isNoTimeLimit = expiresAt === 0;

  // ── Expired / Zeroized View ─────────────────────────────────────────────────
  if (isExpired) {
    return (
      <main className="min-h-screen w-full bg-[#080B14] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">
        <AuraCanvas />
        <div className="relative z-10 max-w-sm w-full apple-frosted-glass rounded-3xl p-8 border border-white/10 text-center shadow-2xl flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-2">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>
          <h1 className="text-xl font-heading font-black text-white">Link Hub Expired</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            This ephemeral link hub has reached its time-to-live limit and was purged according to DoD zeroize standards.
          </p>
          <div className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-slate-400 mt-2">
            Bundle ID: {bundleId}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-[#060810] text-white flex flex-col items-center justify-between relative overflow-x-hidden selection:bg-indigo-500/30">
      {/* Background Ambience Canvas */}
      <AuraCanvas />

      {/* Dynamic Theme Ambient Glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px] rounded-full blur-[140px] opacity-25 pointer-events-none transition-colors duration-700"
        style={{ backgroundColor: bundle.themeColor || '#6366F1' }}
      />

      {/* Top Floating Share Button (Recipient friendly) */}
      <header className="w-full max-w-md mx-auto pt-6 px-4 flex items-center justify-end relative z-20">
        <button
          type="button"
          onClick={handleShare}
          className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white backdrop-blur-xl transition-all cursor-pointer shadow-lg active:scale-95"
          title="Share Link Hub"
        >
          {copiedShare ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
        </button>
      </header>

      {/* ── Main Mobile-First Canvas (Max-w-md, Clean, Read-Only) ── */}
      <div className="w-full max-w-md mx-auto px-4 py-4 flex-1 flex flex-col items-center justify-start relative z-10">
        {/* Loading Skeleton */}
        {isLoading ? (
          <div className="w-full flex flex-col items-center gap-6 animate-pulse py-12">
            <div className="w-24 h-24 rounded-full bg-white/10 border border-white/15" />
            <div className="h-6 w-36 bg-white/15 rounded-xl" />
            <div className="h-3 w-48 bg-white/10 rounded-lg" />
            <div className="w-full space-y-3 mt-4">
              <div className="h-16 w-full bg-white/5 rounded-2xl border border-white/10" />
              <div className="h-16 w-full bg-white/5 rounded-2xl border border-white/10" />
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center animate-in fade-in duration-300">
            {/* 1. TOP PROFILE HEADER */}
            <div className="flex flex-col items-center text-center mb-6">
              {/* Profile Avatar Badge */}
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-white shadow-2xl ring-4 ring-white/15 mb-3 transition-transform duration-300 hover:scale-105"
                style={{ backgroundColor: bundle.themeColor || '#6366F1' }}
              >
                {bundle.avatarIcon === 'shield' ? (
                  <Shield className="w-11 h-11" />
                ) : bundle.avatarIcon === 'lock' ? (
                  <Lock className="w-11 h-11" />
                ) : bundle.avatarIcon === 'globe' ? (
                  <Globe className="w-11 h-11" />
                ) : bundle.avatarIcon === 'monogram' ? (
                  <span className="font-heading font-black text-3xl tracking-tight">
                    {(bundle.title || bundleId).substring(0, 2).toUpperCase()}
                  </span>
                ) : (
                  <Sparkles className="w-11 h-11" />
                )}
              </div>

              {/* Creator / Bundle Title (e.g. "Karan") */}
              <h1 className="text-2xl font-heading font-extrabold text-white tracking-tight leading-snug">
                {bundle.title || bundleId}
              </h1>

              {/* Subtitle / Creator Name (e.g. "Hlo") */}
              {bundle.customName && (
                <span className="text-sm font-semibold text-indigo-300 mt-0.5">
                  {bundle.customName}
                </span>
              )}

              {/* Bio / Description */}
              {bundle.bio && (
                <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-xs font-normal leading-relaxed">
                  {bundle.bio}
                </p>
              )}

              {/* Ephemeral TTL Pill Badge */}
              <div className="mt-3">
                {isNoTimeLimit ? (
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold shadow-xs">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Permanent Linktree • No Time Limit</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[11px] font-bold shadow-xs">
                    <Clock className="w-3.5 h-3.5 animate-pulse text-indigo-400" />
                    <span>Expires in {formatCountdown(secondsRemaining)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. INTERACTIVE LINK BUTTONS (The Core Payload) */}
            <div className="w-full space-y-3 mb-8">
              {bundle.links && bundle.links.length > 0 ? (
                bundle.links.map((link) => (
                  <a
                    key={link.id}
                    href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.preventDefault();
                      handleLinkClick(link);
                    }}
                    className="w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 hover:border-white/25 shadow-lg backdrop-blur-xl flex items-center justify-between gap-3.5 transition-all duration-200 text-left group cursor-pointer"
                  >
                    {/* Left: Brand Icon or Favicon */}
                    <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:border-white/20 transition-all shadow-inner">
                      <BrandIcon url={link.url} category={link.category} />
                    </div>

                    {/* Center: Clean Link Title & Metadata */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-heading font-bold text-sm text-white group-hover:text-indigo-200 transition-colors truncate">
                          {link.title}
                        </span>
                        {link.tag && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                            {link.tag}
                          </span>
                        )}
                      </div>
                      {link.description && (
                        <p className="text-xs text-slate-400 truncate font-normal">
                          {link.description}
                        </p>
                      )}
                    </div>

                    {/* Right: Directional Arrow */}
                    <div className="shrink-0 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </a>
                ))
              ) : (
                <div className="w-full p-8 rounded-2xl bg-white/5 border border-white/10 text-center text-slate-400 text-xs">
                  No links active in this hub yet.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. WATERMARK FOOTER (Zero Edit Buttons, Zero Admin Tools) */}
      <footer className="w-full max-w-md mx-auto pb-8 pt-4 px-4 flex flex-col items-center text-center relative z-20">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-[11px] font-medium text-slate-400 shadow-xs">
          <Lock className="w-3 h-3 text-indigo-400" />
          <span>AuraDrop • Zero Trace Ephemeral Vault</span>
        </div>
      </footer>
    </main>
  );
}
