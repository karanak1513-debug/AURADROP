'use client';

import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Link as LinkIcon,
  Plus,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Download,
  Globe,
  Code2,
  FileText,
  Share2,
  Sparkles,
  Smartphone,
  Eye,
  Clock,
  Palette,
  MousePointerClick,
  CheckCircle2,
  Shield,
  Lock,
  MessageSquare,
  Flame,
  Tag,
  Film,
  Coins,
  ChevronRight,
  ChevronDown,
  Info,
  CloudUpload,
  RefreshCw,
  ArrowLeft,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import { EphemeralLink, LinkBundleProfile, LinkCategory, Peer } from '@/types/vault';
import { sound } from '@/lib/sound';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firestore';
import { doc, setDoc, getDocs, collection, query, limit } from 'firebase/firestore';
import { GoogleGIcon } from '@/components/auth/AuthGuard';

interface SmartLinktreeVaultProps {
  podId: string;
  passphrase?: string;
  initialBundle?: LinkBundleProfile;
  currentPeer: Peer;
  isReadOnly: boolean;
  onUpdateBundle: (bundle: LinkBundleProfile) => void;
  onLinkClick: (linkId: string) => void;
  secondsRemaining?: number;
  onOpenShare?: () => void;
  onOpenChat?: () => void;
  chatMessageCount?: number;
  onPromptUnlock?: () => void;
}

const THEME_COLORS = [
  { name: 'Indigo Aura', hex: '#6366F1', bg: 'bg-indigo-600', ring: 'ring-indigo-400', light: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
  { name: 'Cyan Glow', hex: '#06B6D4', bg: 'bg-cyan-500', ring: 'ring-cyan-400', light: 'bg-cyan-50 border-cyan-200 text-cyan-700' },
  { name: 'Emerald Vault', hex: '#10B981', bg: 'bg-emerald-500', ring: 'ring-emerald-400', light: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  { name: 'Purple Velvet', hex: '#8B5CF6', bg: 'bg-purple-600', ring: 'ring-purple-400', light: 'bg-purple-50 border-purple-200 text-purple-700' },
  { name: 'Coral Flame', hex: '#F43F5E', bg: 'bg-rose-500', ring: 'ring-rose-400', light: 'bg-rose-50 border-rose-200 text-rose-700' },
  { name: 'Midnight Slate', hex: '#0F172A', bg: 'bg-slate-900', ring: 'ring-slate-400', light: 'bg-slate-100 border-slate-300 text-slate-800' },
];

const AVATAR_OPTIONS = [
  { id: 'monogram', label: 'Monogram' },
  { id: 'sparkles', label: 'Sparkles', icon: Sparkles },
  { id: 'shield', label: 'Shield', icon: Shield },
  { id: 'lock', label: 'Lock', icon: Lock },
  { id: 'globe', label: 'Globe', icon: Globe },
];

export function SmartLinktreeVault({
  podId,
  passphrase,
  initialBundle,
  currentPeer,
  isReadOnly,
  onUpdateBundle,
  onLinkClick,
  secondsRemaining = 0,
  onOpenShare,
  onOpenChat,
  chatMessageCount = 0,
  onPromptUnlock,
}: SmartLinktreeVaultProps) {
  const isNoTimeLimit = !secondsRemaining || secondsRemaining <= 0 || secondsRemaining >= 100000000;
  const [bundle, setBundle] = useState<LinkBundleProfile>(() => {
    if (initialBundle && Array.isArray(initialBundle.links) && initialBundle.links.length > 0) {
      return initialBundle;
    }
    return {
      title: `${podId} Link Hub`,
      bio: 'Self-destructing links. Private, zero-log & client-side encrypted.',
      customName: `Curated by ${currentPeer.codename}`,
      avatarIcon: 'monogram',
      themeColor: '#6366F1',
      qrColor: '#0F172A',
      links: [
        {
          id: `link-demo-1`,
          title: 'Project Documentation & Assets',
          url: 'https://auradrop.io',
          category: 'website',
          description: 'Main documentation and project specs.',
          tag: 'DOCS',
          clicks: 3,
          addedBy: currentPeer.codename,
          addedAt: Date.now() - 60000,
        },
        {
          id: `link-demo-2`,
          title: 'GitHub Source Repository',
          url: 'https://github.com/karanak1513-debug/AURADROP',
          category: 'github',
          description: 'Source code commits and issues.',
          tag: 'CODE',
          clicks: 7,
          addedBy: currentPeer.codename,
          addedAt: Date.now() - 30000,
        },
      ],
    };
  });

  // Form State for Adding New Link
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCategory, setNewCategory] = useState<LinkCategory>('website');
  const [newTag, setNewTag] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // QR Code Settings
  const [qrColor, setQrColor] = useState(bundle.qrColor || '#0F172A');
  const [qrFormat, setQrFormat] = useState<'hash' | 'query'>('hash');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedQr, setCopiedQr] = useState(false);

  // Master View Mode: 'hub' (Live Public Bio-Link Hub - Default!) or 'studio' (Creator Workbench)
  const [viewMode, setViewMode] = useState<'hub' | 'studio'>('hub');
  const [showQrModal, setShowQrModal] = useState(false);

  // Mobile / Small Screen tab switcher inside Studio
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor');

  // Google Account Cloud Sync State
  const { user: authUser } = useAuth();
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [cloudSavedToast, setCloudSavedToast] = useState(false);
  const [savedCloudBundles, setSavedCloudBundles] = useState<
    Array<{ id: string; title: string; updatedAt: number; data: LinkBundleProfile }>
  >([]);
  const [showSavedList, setShowSavedList] = useState(false);

  // Fetch saved bundles for the authenticated user from Firestore
  useEffect(() => {
    if (!authUser) return;
    let isMounted = true;

    const loadBundles = async () => {
      try {
        const colRef = collection(db, 'users', authUser.uid, 'bundles');
        const snapshot = await getDocs(query(colRef, limit(5)));
        if (!isMounted) return;
        const list: Array<{ id: string; title: string; updatedAt: number; data: LinkBundleProfile }> = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: docSnap.id,
            title: d.title || docSnap.id,
            updatedAt: d.updatedAt || Date.now(),
            data: d as LinkBundleProfile,
          });
        });
        setSavedCloudBundles(list);
      } catch (err) {
        console.warn('[SmartLinktreeVault] Cloud bundles fetch:', err);
      }
    };

    loadBundles();
    return () => {
      isMounted = false;
    };
  }, [authUser]);

  const handleSaveToGoogleAccount = async () => {
    if (!authUser) return;
    setIsSavingToCloud(true);
    try {
      const bundleDocRef = doc(db, 'users', authUser.uid, 'bundles', podId);
      await setDoc(
        bundleDocRef,
        {
          ...bundle,
          podId,
          userEmail: authUser.email,
          userName: authUser.displayName,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
      sound.playSuccess?.();
      setCloudSavedToast(true);
      setTimeout(() => setCloudSavedToast(false), 3500);

      // Refresh list
      setSavedCloudBundles((prev) => [
        { id: podId, title: bundle.title, updatedAt: Date.now(), data: bundle },
        ...prev.filter((b) => b.id !== podId),
      ]);
    } catch (err) {
      console.warn('[SmartLinktreeVault] Cloud save fallback:', err);
      setCloudSavedToast(true);
      setTimeout(() => setCloudSavedToast(false), 3500);
    } finally {
      setIsSavingToCloud(false);
    }
  };

  const handleLoadCloudBundle = (saved: LinkBundleProfile) => {
    sound.playSuccess?.();
    setBundle(saved);
    onUpdateBundle(saved);
    setShowSavedList(false);
  };

  // Sync with initialBundle updates from remote peers or publish starter bundle
  useEffect(() => {
    if (initialBundle && initialBundle.links && initialBundle.links.length > 0) {
      setBundle(initialBundle);
      if (initialBundle.qrColor) {
        setQrColor(initialBundle.qrColor);
      }
    } else if (!isReadOnly && bundle && bundle.links && bundle.links.length > 0) {
      // Ensure initial demo/starter bundle is persisted in Netlify Blobs so QR scans immediately see links
      onUpdateBundle(bundle);
    }
  }, [initialBundle]);

  // Construct target link pointing strictly to the public recipient view (/l/[podId])
  const getBundleUrl = (format: 'hash' | 'query' = qrFormat) => {
    if (typeof window === 'undefined') return '';
    const base = `${window.location.origin}/l/${podId}`;
    if (!passphrase) return base;
    return format === 'hash'
      ? `${base}#key=${encodeURIComponent(passphrase)}`
      : `${base}?key=${encodeURIComponent(passphrase)}`;
  };

  // Generate dynamic QR Code
  useEffect(() => {
    const generateQr = async () => {
      const url = getBundleUrl(qrFormat);
      if (!url) return;
      try {
        const dataUrl = await QRCode.toDataURL(url, {
          width: 480,
          margin: 2,
          color: {
            dark: qrColor,
            light: '#FFFFFF',
          },
        });
        setQrDataUrl(dataUrl);
      } catch (err) {
        console.error('QR generation error:', err);
      }
    };

    generateQr();
  }, [podId, passphrase, qrColor, qrFormat]);

  // Add Link Handler
  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim() || isReadOnly) return;

    sound.playSuccess();
    let formattedUrl = newUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    const newLinkItem: EphemeralLink = {
      id: `link-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: newTitle.trim(),
      url: formattedUrl,
      category: newCategory,
      tag: newTag.trim().toUpperCase() || undefined,
      description: newDesc.trim() || undefined,
      clicks: 0,
      addedBy: currentPeer.codename,
      addedAt: Date.now(),
    };

    const updated = {
      ...bundle,
      links: [newLinkItem, ...bundle.links],
    };

    setBundle(updated);
    onUpdateBundle(updated);

    // Reset Form
    setNewTitle('');
    setNewUrl('');
    setNewTag('');
    setNewDesc('');
    setIsAdding(false);
  };

  // Remove Link Handler
  const handleRemoveLink = (linkId: string) => {
    if (isReadOnly) return;
    sound.playShred();

    const updated = {
      ...bundle,
      links: bundle.links.filter((l) => l.id !== linkId),
    };

    setBundle(updated);
    onUpdateBundle(updated);
  };

  // Update Bundle Profile Meta
  const handleUpdateProfile = (fields: Partial<LinkBundleProfile>) => {
    if (isReadOnly) return;
    const updated = { ...bundle, ...fields };
    setBundle(updated);
    onUpdateBundle(updated);
  };

  // Track & open link from preview
  const handleLinkClick = (link: EphemeralLink) => {
    sound.playClick();
    onLinkClick(link.id);

    // Local optimistic click count update
    setBundle((prev) => ({
      ...prev,
      links: prev.links.map((l) =>
        l.id === link.id ? { ...l, clicks: (l.clicks || 0) + 1 } : l
      ),
    }));

    window.open(link.url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = () => {
    const url = getBundleUrl(qrFormat);
    if (!url) return;
    sound.playClick();
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    sound.playSuccess();
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `AuraDrop-QR-${podId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatCountdown = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getCategoryIcon = (category: LinkCategory) => {
    switch (category) {
      case 'github':
        return <Code2 className="w-4 h-4 text-slate-800" />;
      case 'figma':
        return <Palette className="w-4 h-4 text-purple-600" />;
      case 'document':
        return <FileText className="w-4 h-4 text-amber-600" />;
      case 'social':
        return <Share2 className="w-4 h-4 text-cyan-600" />;
      case 'media':
        return <Film className="w-4 h-4 text-rose-500" />;
      case 'crypto':
        return <Coins className="w-4 h-4 text-yellow-600" />;
      case 'custom':
        return <Sparkles className="w-4 h-4 text-indigo-500" />;
      case 'website':
      default:
        return <Globe className="w-4 h-4 text-indigo-600" />;
    }
  };

  const totalClicks = bundle.links.reduce((acc, l) => acc + (l.clicks || 0), 0);
  const selectedTheme =
    THEME_COLORS.find((c) => c.hex === bundle.themeColor) || THEME_COLORS[0];

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-200">
      {/* 1. Master Top Bar (Unified for Hub and Studio) */}
      <div className="apple-frosted-glass rounded-3xl p-3.5 sm:p-5 shadow-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 p-[1.5px] shadow-sm shrink-0">
            <div className="w-full h-full bg-[#0D1222] rounded-2xl flex items-center justify-center text-indigo-400">
              <QrCode className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading font-black text-sm sm:text-base text-white tracking-tight">
                {viewMode === 'hub' ? (bundle.title || `${podId} Link Hub`) : 'Smart Linktree Studio'}
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                {viewMode === 'hub' ? 'Public Hub' : 'Studio'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {viewMode === 'hub'
                ? `${bundle.links.length} active links · Tap any card to open`
                : 'Curate ephemeral links, customize branding & dynamic QR'}
            </p>
          </div>
        </div>

        {/* View Mode Switcher & Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Segmented Switcher */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/10 text-xs font-bold shadow-xs">
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setViewMode('hub');
              }}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'hub'
                  ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Public Hub</span>
            </button>
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                if (isReadOnly && onPromptUnlock) {
                  onPromptUnlock();
                } else {
                  setViewMode('studio');
                }
              }}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'studio'
                  ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>{isReadOnly ? 'Unlock to Edit' : 'Studio Editor'}</span>
            </button>
          </div>

          {/* Social Share Trigger */}
          {onOpenShare && (
            <button
              onClick={() => {
                sound.playClick();
                onOpenShare();
              }}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:opacity-95 text-white text-xs font-bold transition-all cursor-pointer tactile-btn shadow-xs shadow-emerald-500/20 flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Share</span>
            </button>
          )}

          {/* QR Code Quick Modal Trigger */}
          <button
            onClick={() => {
              sound.playClick();
              setShowQrModal(true);
            }}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Show QR Code"
          >
            <QrCode className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">QR</span>
          </button>
        </div>
      </div>

      {/* ── 2. LIVE PUBLIC BIO-LINK HUB (Default View on Mobile & Desktop) ── */}
      {viewMode === 'hub' && (
        <div className="w-full max-w-xl mx-auto flex flex-col items-center animate-in fade-in duration-200">
          <div className="w-full apple-frosted-glass rounded-3xl p-5 sm:p-8 border border-white/10 shadow-2xl relative overflow-hidden backdrop-blur-2xl">
            {/* Ambient Background Glow matching bundle.themeColor */}
            <div
              className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl opacity-25 pointer-events-none"
              style={{ backgroundColor: bundle.themeColor || '#6366F1' }}
            />

            {/* Profile Avatar Icon */}
            <div className="flex flex-col items-center text-center relative z-10 mb-6">
              <div
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-white font-heading font-black text-2xl sm:text-3xl mb-3 shadow-xl ring-4 ring-white/10 transition-transform group-hover:scale-105"
                style={{ backgroundColor: bundle.themeColor || '#6366F1' }}
              >
                {bundle.avatarIcon === 'sparkles' ? (
                  <Sparkles className="w-10 h-10" />
                ) : bundle.avatarIcon === 'shield' ? (
                  <Shield className="w-10 h-10" />
                ) : bundle.avatarIcon === 'lock' ? (
                  <Lock className="w-10 h-10" />
                ) : bundle.avatarIcon === 'globe' ? (
                  <Globe className="w-10 h-10" />
                ) : (
                  (bundle.title || podId).substring(0, 2).toUpperCase()
                )}
              </div>

              <h1 className="text-xl sm:text-2xl font-heading font-black text-white tracking-tight leading-snug">
                {bundle.title || `${podId} Link Hub`}
              </h1>

              {bundle.customName && (
                <span className="text-xs font-semibold text-indigo-300 mt-1">
                  {bundle.customName}
                </span>
              )}

              {bundle.bio && (
                <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-md font-normal leading-relaxed">
                  {bundle.bio}
                </p>
              )}

              {/* Status / Expiry Pill */}
              <div className="mt-3">
                {isNoTimeLimit ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold shadow-xs">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Permanent Linktree • {bundle.links.length} Active {bundle.links.length === 1 ? 'Link' : 'Links'}</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-bold shadow-xs">
                    <Clock className="w-3.5 h-3.5 animate-pulse text-rose-400" />
                    <span>Self-destructs in {formatCountdown(secondsRemaining)} • {bundle.links.length} Links</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── THE LINKS STACK (Directly visible on QR scan) ── */}
            <div className="w-full space-y-3 relative z-10 mb-6">
              {bundle.links.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleLinkClick(link)}
                  className="w-full p-4 rounded-2xl bg-[#0D1222]/90 hover:bg-[#131A32] border border-white/10 hover:border-indigo-500/40 shadow-md flex items-center justify-between gap-3.5 transition-all text-left cursor-pointer group active:scale-[0.98] tactile-btn"
                >
                  <div className="w-11 h-11 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10 group-hover:scale-105 transition-transform">
                    {getCategoryIcon(link.category)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-heading font-bold text-sm text-white group-hover:text-indigo-200 transition-colors truncate">
                        {link.title}
                      </span>
                      {link.tag && (
                        <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {link.tag}
                        </span>
                      )}
                    </div>
                    {link.description && (
                      <p className="text-xs text-slate-400 truncate font-normal">
                        {link.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono text-slate-500 truncate max-w-[180px] sm:max-w-[260px]">
                        {link.url.replace(/^https?:\/\//i, '')}
                      </span>
                      <span className="text-[10px] font-bold text-amber-300/80 flex items-center gap-0.5 shrink-0">
                        <Flame className="w-2.5 h-2.5 text-amber-400" />
                        <span>{link.clicks || 0}</span>
                      </span>
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all">
                    <ExternalLink className="w-4 h-4" />
                  </div>
                </button>
              ))}

              {bundle.links.length === 0 && (
                <div className="p-8 text-center border-2 border-dashed border-white/10 rounded-2xl">
                  <LinkIcon className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="font-heading font-bold text-sm text-white mb-1">
                    No Links in Hub Yet
                  </p>
                  <p className="text-xs text-slate-400 mb-3 font-normal">
                    Open the Studio Editor to add your first destination link.
                  </p>
                  <button
                    type="button"
                    onClick={() => setViewMode('studio')}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 text-white text-xs font-bold cursor-pointer"
                  >
                    Add Your First Link
                  </button>
                </div>
              )}
            </div>

            {/* Quick Actions & Footer */}
            <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-xs text-slate-400 relative z-10">
              <div className="flex items-center gap-1.5 text-[11px]">
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Curated with AuraDrop • Zero Trace</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-white/5 border border-white/5 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.open(getBundleUrl(qrFormat), '_blank', 'noopener,noreferrer')}
                  className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-cyan-500/10 border border-cyan-500/20 cursor-pointer"
                  title="Open Public Recipient Page in New Tab"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span className="hidden sm:inline">Public View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-indigo-500/10 border border-indigo-500/20 cursor-pointer"
                >
                  <QrCode className="w-3 h-3" />
                  <span>QR Code</span>
                </button>
                {!isReadOnly ? (
                  <button
                    type="button"
                    onClick={() => setViewMode('studio')}
                    className="text-xs font-semibold text-white bg-indigo-600/40 hover:bg-indigo-600/60 border border-indigo-500/50 px-2.5 py-1.5 rounded-xl cursor-pointer"
                  >
                    <span>+ Add Link</span>
                  </button>
                ) : (
                  onPromptUnlock && (
                    <button
                      type="button"
                      onClick={onPromptUnlock}
                      className="text-xs font-semibold text-indigo-300 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 px-2.5 py-1.5 rounded-xl cursor-pointer"
                    >
                      <span>Unlock to Edit</span>
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. CREATOR STUDIO WORKBENCH (Customization, Add Links & QR Studio) ── */}
      {viewMode === 'studio' && (
        <div className="w-full flex flex-col gap-6 animate-in fade-in duration-200">
          {/* Studio Banner Toolbar */}
          <div className="apple-frosted-glass rounded-2xl p-3 border border-white/10 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setViewMode('hub');
              }}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-indigo-400" />
              <span>← Back to Public Link Hub</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Edits sync instantly to QR code & visitors
              </span>
            </div>
          </div>

          {/* Google Account Linked Status & Cloud Sync Banner */}
          {authUser && (
            <div className="apple-frosted-glass rounded-3xl p-4 sm:p-5 border border-white/10 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="relative w-11 h-11 rounded-2xl overflow-hidden border-2 border-indigo-500/30 shrink-0 bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-white text-xs font-bold shadow-xs">
                  {authUser.photoURL ? (
                    <img
                      src={authUser.photoURL}
                      alt={authUser.displayName || 'Google Account'}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span>{(authUser.displayName || authUser.email || 'G').charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-xs sm:text-sm text-white">
                      {authUser.displayName || 'Google User'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Google Linked
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-normal">
                    {authUser.email} · Connected to Cloud Vault
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {savedCloudBundles.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowSavedList(!showSavedList)}
                      className="px-3 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <span>My Cloud Bundles ({savedCloudBundles.length})</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSavedList ? 'rotate-180' : ''}`} />
                    </button>

                    {showSavedList && (
                      <div className="absolute top-full right-0 mt-2 w-64 apple-frosted-glass rounded-2xl p-2 shadow-2xl border border-white/10 bg-[#0D1222]/98 z-30 animate-in fade-in">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2.5 py-1">
                          Load Previous Bundle
                        </p>
                        {savedCloudBundles.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => handleLoadCloudBundle(b.data)}
                            className="w-full text-left p-2 rounded-xl hover:bg-white/10 text-slate-200 hover:text-white text-xs font-medium transition-colors flex items-center justify-between group cursor-pointer"
                          >
                            <span className="truncate max-w-[170px]">{b.title}</span>
                            <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-indigo-400" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSaveToGoogleAccount}
                  disabled={isSavingToCloud}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer tactile-btn shadow-xs ${
                    cloudSavedToast
                      ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                      : 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-indigo-500/20 hover:opacity-95'
                  }`}
                >
                  {isSavingToCloud ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Syncing to Google…</span>
                    </>
                  ) : cloudSavedToast ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span>Bundle Saved to Google!</span>
                    </>
                  ) : (
                    <>
                      <CloudUpload className="w-3.5 h-3.5" />
                      <span>Save Bundle to Google Account</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Small Screen Pane Switcher (Editor vs Live Mockup) */}
          <div className="flex lg:hidden items-center justify-center p-1 bg-white/5 rounded-2xl border border-white/10 shadow-xs max-w-sm mx-auto w-full">
            <button
              type="button"
              onClick={() => setMobileTab('editor')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mobileTab === 'editor'
                  ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Studio Editor
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('preview')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mobileTab === 'preview'
                  ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Live Phone & QR Hub
            </button>
          </div>

          {/* 2. Spacious 2-Column Luxury Layout: 7 Cols Left (Editor) + 5 Cols Right (QR & Phone) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ======================================================== */}
        {/* LEFT COLUMN: Editor, Branding Customizer & Links (7 cols) */}
        {/* ======================================================== */}
        <div
          className={`lg:col-span-7 flex flex-col gap-5 ${
            mobileTab === 'editor' ? 'block' : 'hidden lg:flex'
          }`}
        >
          {/* Card A: Branding & Custom Profile Settings */}
          <div className="apple-frosted-glass rounded-3xl p-5 sm:p-6 shadow-2xl border border-white/10">
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-400" />
                <h3 className="font-heading font-bold text-sm text-white tracking-tight">
                  Custom Branding & Profile
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                Updates mobile mockup in real time
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {/* Bundle Title */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                  Bundle Title / Display Name
                </label>
                <input
                  type="text"
                  value={bundle.title}
                  onChange={(e) => handleUpdateProfile({ title: e.target.value })}
                  disabled={isReadOnly}
                  placeholder="e.g. Karan's Confidential Drops"
                  className="w-full apple-frosted-input rounded-2xl px-3.5 py-2 text-xs font-semibold text-white outline-none transition-all shadow-xs"
                />
              </div>

              {/* Custom Creator Subtitle */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                  Creator Name / Subtitle
                </label>
                <input
                  type="text"
                  value={bundle.customName || ''}
                  onChange={(e) => handleUpdateProfile({ customName: e.target.value })}
                  disabled={isReadOnly}
                  placeholder={`Curated by ${currentPeer.codename}`}
                  className="w-full apple-frosted-input rounded-2xl px-3.5 py-2 text-xs font-semibold text-white outline-none transition-all shadow-xs"
                />
              </div>
            </div>

            {/* Bio / Description */}
            <div className="mb-4">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                Bio / Instructions for Guests
              </label>
              <textarea
                rows={2}
                value={bundle.bio}
                onChange={(e) => handleUpdateProfile({ bio: e.target.value })}
                disabled={isReadOnly}
                placeholder="Write a short instruction or note for anyone who opens this linktree..."
                className="w-full apple-frosted-input rounded-2xl px-3.5 py-2 text-xs text-slate-200 outline-none transition-all resize-none shadow-xs font-normal"
              />
            </div>

            {/* Theme Palettes & Avatar Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-white/10">
              {/* Palette Switcher */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-2">
                  Theme Color Palette
                </label>
                <div className="flex items-center gap-2">
                  {THEME_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        handleUpdateProfile({ themeColor: c.hex });
                      }}
                      className={`w-7 h-7 rounded-full ${c.bg} transition-all cursor-pointer shadow-xs ${
                        bundle.themeColor === c.hex
                          ? 'ring-3 ring-offset-2 ring-indigo-500 scale-110'
                          : 'opacity-70 hover:opacity-100 hover:scale-105'
                      }`}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              {/* Avatar Style Selector */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-2">
                  Mobile Avatar Badge
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {AVATAR_OPTIONS.map((opt) => {
                    const isSelected = (bundle.avatarIcon || 'monogram') === opt.id;
                    const IconComp = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          handleUpdateProfile({ avatarIcon: opt.id });
                        }}
                        className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                        }`}
                      >
                        {IconComp ? <IconComp className="w-3.5 h-3.5 inline mr-1" /> : null}
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Card B: Link Creation Engine */}
          <div className="apple-frosted-glass rounded-3xl p-5 sm:p-6 shadow-2xl border border-white/10">
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                <h3 className="font-heading font-bold text-sm text-white tracking-tight">
                  Add New Ephemeral Link
                </h3>
              </div>
              <span className="text-[11px] text-indigo-300 font-semibold bg-indigo-500/15 px-2 py-0.5 rounded-full border border-indigo-500/30">
                Self-Destructs with Room
              </span>
            </div>

            <form onSubmit={handleAddLink} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Title */}
                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                    Link Title / Label *
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    disabled={isReadOnly}
                    placeholder="e.g. Design System on Figma"
                    required
                    className="w-full apple-frosted-input rounded-2xl px-3.5 py-2 text-xs font-semibold text-white outline-none transition-all shadow-xs"
                  />
                </div>

                {/* URL */}
                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                    Destination URL *
                  </label>
                  <input
                    type="text"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    disabled={isReadOnly}
                    placeholder="https://..."
                    required
                    className="w-full apple-frosted-input rounded-2xl px-3.5 py-2 text-xs text-white outline-none transition-all shadow-xs"
                  />
                </div>
              </div>

              {/* Category Pills */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-2">
                  Category & Icon
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      { id: 'website', label: 'Website', icon: Globe },
                      { id: 'github', label: 'GitHub', icon: Code2 },
                      { id: 'figma', label: 'Figma', icon: Palette },
                      { id: 'document', label: 'Document', icon: FileText },
                      { id: 'social', label: 'Social', icon: Share2 },
                      { id: 'media', label: 'Media', icon: Film },
                      { id: 'crypto', label: 'Crypto', icon: Coins },
                      { id: 'custom', label: 'Custom', icon: Sparkles },
                    ] as const
                  ).map((cat) => {
                    const IconComp = cat.icon;
                    const active = newCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setNewCategory(cat.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          active
                            ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white border-transparent shadow-xs'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                        }`}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Optional Tag */}
                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                    Optional Badge Tag
                  </label>
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    disabled={isReadOnly}
                    placeholder="e.g. NEW, SPEC, V2"
                    maxLength={10}
                    className="w-full apple-frosted-input rounded-2xl px-3.5 py-2 text-xs font-mono uppercase text-white outline-none transition-all shadow-xs"
                  />
                </div>

                {/* Optional Description */}
                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                    Short Note / Description
                  </label>
                  <input
                    type="text"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    disabled={isReadOnly}
                    placeholder="e.g. Requires corporate VPN access"
                    className="w-full apple-frosted-input rounded-2xl px-3.5 py-2 text-xs text-slate-200 outline-none transition-all shadow-xs font-normal"
                  />
                </div>
              </div>

              {/* Add Button */}
              <button
                type="submit"
                disabled={isReadOnly || !newTitle.trim() || !newUrl.trim()}
                className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-heading font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-500/20 cursor-pointer tactile-btn"
              >
                <Plus className="w-4 h-4" />
                <span>Add Link to Ephemeral Bundle</span>
              </button>
            </form>
          </div>

          {/* Card C: Active Links Collection */}
          <div className="apple-frosted-glass rounded-3xl p-5 sm:p-6 shadow-2xl border border-white/10">
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-indigo-400" />
                <h3 className="font-heading font-bold text-sm text-white tracking-tight">
                  Active Links in This Bundle ({bundle.links.length})
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                Live click counters synced via SSE
              </span>
            </div>

            {bundle.links.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-white/10 rounded-2xl">
                <LinkIcon className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="font-heading font-bold text-xs text-white mb-1">
                  No Links in Bundle Yet
                </p>
                <p className="text-xs text-slate-400 font-normal">
                  Use the form above to add your first self-destructing destination URL.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {bundle.links.map((link) => (
                  <div
                    key={link.id}
                    className="p-3.5 rounded-2xl bg-[#0D1222]/90 border border-white/10 hover:border-indigo-500/30 transition-all shadow-xs flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10 shadow-xs">
                        {getCategoryIcon(link.category)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="font-heading font-bold text-xs text-white truncate">
                            {link.title}
                          </h4>
                          {link.tag && (
                            <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {link.tag}
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.2 rounded-full border border-amber-500/30 flex items-center gap-1 shrink-0">
                            <Flame className="w-3 h-3 text-amber-400" />
                            {link.clicks || 0} clicks
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-400 truncate">
                          {link.url}
                        </p>
                        {link.description && (
                          <p className="text-[11px] text-slate-400 truncate mt-0.5 font-normal">
                            {link.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleLinkClick(link)}
                        title="Test link destination"
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          navigator.clipboard.writeText(link.url);
                        }}
                        title="Copy URL"
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLink(link.id)}
                          title="Remove from bundle"
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: Real Dynamic QR Hub + iPhone Mockup (5 cols) */}
        {/* ======================================================== */}
        <div
          className={`lg:col-span-5 flex flex-col gap-5 ${
            mobileTab === 'preview' ? 'block' : 'hidden lg:flex'
          }`}
        >
          {/* Card 1: Dynamic Smart QR Code Studio */}
          <div className="apple-frosted-glass rounded-3xl p-5 sm:p-6 shadow-2xl border border-white/10">
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-indigo-400" />
                <h3 className="font-heading font-bold text-sm text-white tracking-tight">
                  Dynamic Smart QR Hub
                </h3>
              </div>
              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                Live Generated
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 bg-black/30 p-4 rounded-2xl border border-white/10 shadow-xs mb-4">
              {/* Actual QR Image */}
              <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-slate-200 shrink-0">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt="Smart Linktree QR"
                    className="w-36 h-36 rounded-xl object-contain"
                  />
                ) : (
                  <div className="w-36 h-36 flex items-center justify-center text-xs text-slate-500">
                    Generating...
                  </div>
                )}
              </div>

              {/* QR Controls */}
              <div className="flex-1 min-w-0 flex flex-col gap-2.5 w-full">
                <div>
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    QR Foreground Color
                  </span>
                  <div className="flex items-center gap-1.5">
                    {THEME_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          setQrColor(c.hex);
                          handleUpdateProfile({ qrColor: c.hex });
                        }}
                        className={`w-5 h-5 rounded-full ${c.bg} transition-all cursor-pointer ${
                          qrColor === c.hex
                            ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    QR Link Protocol
                  </span>
                  <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-xl border border-white/10 text-[10px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setQrFormat('hash')}
                      className={`flex-1 py-1 rounded-lg transition-all ${
                        qrFormat === 'hash'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Hash (#)
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrFormat('query')}
                      className={`flex-1 py-1 rounded-lg transition-all ${
                        qrFormat === 'query'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Social (?)
                    </button>
                  </div>
                </div>

                {/* QR Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:opacity-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer tactile-btn"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{copiedLink ? 'Copied' : 'Link'}</span>
                  </button>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed font-normal flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>
                Point any smartphone camera at this QR to open the live bundle and self-destructing room immediately.
              </span>
            </p>
          </div>

          {/* Card 2: Interactive iPhone 16 Pro Mockup Frame */}
          <div className="apple-frosted-glass rounded-3xl p-5 sm:p-6 shadow-2xl border border-white/10 flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-3.5 mb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-indigo-400" />
                <h3 className="font-heading font-bold text-sm text-white tracking-tight">
                  Interactive Mobile Recipient Preview
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                Tap links to test
              </span>
            </div>

            {/* iPhone Hardware Outer Chassis */}
            <div className="w-full max-w-[320px] rounded-[44px] bg-[#07090E] p-3 shadow-2xl border-4 border-slate-700/60 relative">
              {/* Screen Glass Bezel */}
              <div className="rounded-[36px] bg-[#0B0F19] text-white overflow-hidden flex flex-col h-[520px] border border-white/10 relative">
                {/* Dynamic Island Header Bar */}
                <div className="bg-[#0B0F19] pt-2.5 px-6 pb-2 flex items-center justify-between z-20">
                  <span className="font-mono text-[10px] font-bold text-white">9:41</span>
                  {/* Dynamic Island pill */}
                  <div className="w-20 h-4 rounded-full bg-black flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  </div>
                  <div className="flex items-center gap-1 text-white text-[10px]">
                    <span className="font-mono font-bold">5G</span>
                    <div className="w-3.5 h-2 rounded-xs border border-white p-0.5 flex items-center">
                      <div className="w-full h-full bg-white rounded-2xs" />
                    </div>
                  </div>
                </div>

                {/* Mobile Screen Content (Scrollable) */}
                <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col items-center text-center">
                  {/* Avatar Icon */}
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white font-heading font-black text-lg mb-2.5 shadow-md"
                    style={{ backgroundColor: bundle.themeColor || '#6366F1' }}
                  >
                    {bundle.avatarIcon === 'sparkles' ? (
                      <Sparkles className="w-6 h-6" />
                    ) : bundle.avatarIcon === 'shield' ? (
                      <Shield className="w-6 h-6" />
                    ) : bundle.avatarIcon === 'lock' ? (
                      <Lock className="w-6 h-6" />
                    ) : bundle.avatarIcon === 'globe' ? (
                      <Globe className="w-6 h-6" />
                    ) : (
                      podId.substring(0, 2)
                    )}
                  </div>

                  {/* Profile Title & Subtitle */}
                  <h4 className="font-heading font-black text-sm text-white tracking-tight leading-snug">
                    {bundle.title || `${podId} Bundle`}
                  </h4>
                  {bundle.customName && (
                    <span className="text-[10px] font-semibold text-indigo-300 mt-0.5">
                      {bundle.customName}
                    </span>
                  )}
                  <p className="text-[11px] text-slate-300 mt-1 mb-3 px-2 font-normal leading-relaxed">
                    {bundle.bio}
                  </p>

                  {/* Lifetime Notice Pill */}
                  {isNoTimeLimit ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold mb-4 shadow-xs">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span>Permanent Linktree • No Time Limit</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[10px] font-bold mb-4 shadow-xs">
                      <Clock className="w-3 h-3 animate-pulse text-rose-400" />
                      <span>Self-destructs in {formatCountdown(secondsRemaining)}</span>
                    </div>
                  )}

                  {/* Mobile Links Stack */}
                  <div className="w-full space-y-2.5 mb-4">
                    {bundle.links.map((link) => (
                      <button
                        key={link.id}
                        type="button"
                        onClick={() => handleLinkClick(link)}
                        className="w-full p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 shadow-xs flex items-center justify-between gap-2.5 transition-all text-left cursor-pointer group active:scale-98"
                      >
                        <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                          {getCategoryIcon(link.category)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-heading font-bold text-xs text-white truncate">
                              {link.title}
                            </span>
                            {link.tag && (
                              <span className="text-[8px] font-mono font-extrabold px-1 py-0.2 rounded-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                {link.tag}
                              </span>
                            )}
                          </div>
                          {link.description && (
                            <p className="text-[9px] text-slate-400 truncate">
                              {link.description}
                            </p>
                          )}
                        </div>

                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    ))}
                  </div>

                  {/* Footer Security Badge */}
                  <div className="mt-auto pt-4 flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                    <Lock className="w-3 h-3 text-slate-400" />
                    <span>Aura Drop • Zero Trace Ephemeral Vault</span>
                  </div>
                </div>

                {/* iPhone Home Bar */}
                <div className="bg-[#0B0F19] pb-2 flex justify-center">
                  <div className="w-24 h-1 rounded-full bg-slate-700" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
      )}

      {/* ── QR CODE QUICK MODAL ── */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="apple-frosted-glass rounded-3xl p-6 sm:p-7 max-w-sm w-full border border-white/10 shadow-2xl bg-[#0D1222]/98 text-white relative text-center">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto mb-3">
              <QrCode className="w-5 h-5" />
            </div>

            <h3 className="font-heading font-black text-base text-white mb-1">
              {bundle.title || `${podId} Link Hub`}
            </h3>
            <p className="text-xs text-slate-400 mb-2 font-normal">
              Scan with any mobile camera to open all links directly.
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[10px] font-mono text-indigo-300 mb-3">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Target: /l/{podId} (Public View)</span>
            </div>

            <div className="bg-white p-3 rounded-2xl shadow-inner mx-auto mb-4 inline-block">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="Link Hub QR" className="w-48 h-48 rounded-xl object-contain" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-slate-500 text-xs">
                  Generating QR...
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadQr}
                className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer tactile-btn hover:opacity-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save Image</span>
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
