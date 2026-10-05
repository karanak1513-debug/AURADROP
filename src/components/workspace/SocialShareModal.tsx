'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Download,
  Smartphone,
  Sparkles,
  Clock,
  Lock,
  ShieldCheck,
  X,
  Send,
  MessageCircle,
  Mail,
  CheckCircle2,
  Key,
  Eye,
  EyeOff,
} from 'lucide-react';
import QRCode from 'qrcode';
import { PodMetadata } from '@/types/vault';
import { sound } from '@/lib/sound';
import { createChatRoomRecord, saveLinktreeBundleRecord } from '@/lib/rooms';

interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: PodMetadata;
  passphrase?: string;
  secondsRemaining?: number;
}

export function SocialShareModal({
  isOpen,
  onClose,
  metadata,
  passphrase,
  secondsRemaining = 3600,
}: SocialShareModalProps) {
  // Link format: 'hash' (#key=) or 'query' (?key=)
  const [linkType, setLinkType] = useState<'hash' | 'query'>('hash');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedRoomId, setCopiedRoomId] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedInstagram, setCopiedInstagram] = useState(false);
  const [copiedFullMessage, setCopiedFullMessage] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [includeTimerInMsg, setIncludeTimerInMsg] = useState(true);

  // Authoritative handshake commit to Firestore BEFORE user shares link
  useEffect(() => {
    if (!isOpen || !metadata?.id) return;
    const normId = metadata.id.trim().toUpperCase();
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (p.startsWith('/chat/') || p.startsWith('/room/')) {
        createChatRoomRecord(normId, passphrase || '', 1, 'anonymous', { salt: metadata.salt, hostPeerId: metadata.creatorPeerId }).catch(() => {});
      } else if (p.startsWith('/links/') || p.startsWith('/linktree/')) {
        saveLinktreeBundleRecord(normId, `${normId} Link Hub`, [], 'indigo', 24, 'anonymous').catch(() => {});
      }
    }
  }, [isOpen, metadata?.id, metadata?.salt, metadata?.creatorPeerId, passphrase]);

  // Format time remaining
  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  // Generate Base URLs with route detection
  const getAutoJoinUrl = (type: 'hash' | 'query' = linkType) => {
    if (typeof window === 'undefined') return '';
    let routePrefix = 'chat';
    if (window.location.pathname.startsWith('/drop/')) routePrefix = 'drop';
    else if (window.location.pathname.startsWith('/links/')) routePrefix = 'links';
    else if (window.location.pathname.startsWith('/room/')) routePrefix = 'room';
    else if (window.location.pathname.startsWith('/pod/')) routePrefix = 'pod';

    const base = `${window.location.origin}/${routePrefix}/${metadata.id}`;
    if (!passphrase) return base;

    if (type === 'hash') {
      return `${base}#key=${encodeURIComponent(passphrase)}`;
    } else {
      return `${base}?key=${encodeURIComponent(passphrase)}`;
    }
  };

  const autoJoinUrl = getAutoJoinUrl(linkType);

  // Generate QR Code
  useEffect(() => {
    if (!isOpen || !autoJoinUrl) return;

    QRCode.toDataURL(autoJoinUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR code error:', err));
  }, [isOpen, autoJoinUrl]);

  if (!isOpen) return null;

  // Check if No Time Limit (Permanent)
  const isNoTimeLimit =
    !secondsRemaining ||
    secondsRemaining <= 0 ||
    secondsRemaining >= 100000000 ||
    metadata.expiresAt === 0 ||
    metadata.ttlSeconds === 0;

  // Formatted Share Messages (WhatsApp & Instagram with Room ID & Password)
  const timeStr = formatTime(secondsRemaining);
  const isLinktreeRoute =
    typeof window !== 'undefined' &&
    (window.location.pathname.startsWith('/links') || autoJoinUrl.includes('/links/'));

  const shareMessage = isNoTimeLimit
    ? `✨ ${isLinktreeRoute ? 'Smart Linktree & Dynamic QR Hub' : 'Aura Secret Hub'}:\n\n• Code: ${metadata.id}\n• Password: ${passphrase || 'None'}\n• 1-Tap Link: ${autoJoinUrl}\n\n♾️ Permanent Access (No Time Limit).\n🔒 Verified identity & end-to-end encrypted.`
    : `🔒 Aura Drop Secret Room Access:\n\n• Room Code: ${metadata.id}\n• Password: ${passphrase || 'None'}\n• Direct Link: ${autoJoinUrl}\n\n${
        includeTimerInMsg ? `⏳ Self-destructs in ${timeStr}.\n` : ''
      }✨ Zero accounts, zero trace, end-to-end encrypted.`;

  const instagramCaption = isNoTimeLimit
    ? `✨ ${isLinktreeRoute ? 'Smart Linktree & QR Hub' : 'Aura Secret Hub'}\n• Link Code: ${metadata.id}\n• Password: ${passphrase || 'None'}\n♾️ Permanent Access (No Time Limit)\n🔗 1-Tap Link: ${autoJoinUrl}\n🔒 Verified link hub & dynamic QR`
    : `✨ Secret Room on Aura Drop\n• Room ID: ${metadata.id}\n• Password: ${passphrase || 'None'}\n⏳ Erases in ${timeStr}\n🔗 1-Tap Auto-Join Link: ${autoJoinUrl}\n🔒 End-to-end encrypted file vault & chat`;

  // 1. Copy Auto-Join Link
  const handleCopyLink = () => {
    sound.playClick();
    navigator.clipboard.writeText(autoJoinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyRoomId = () => {
    sound.playClick();
    navigator.clipboard.writeText(metadata.id);
    setCopiedRoomId(true);
    setTimeout(() => setCopiedRoomId(false), 2000);
  };

  const handleCopyPassphrase = () => {
    if (!passphrase) return;
    sound.playClick();
    navigator.clipboard.writeText(passphrase);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2000);
  };

  // 2. WhatsApp Direct Share
  const handleWhatsAppShare = () => {
    sound.playClick();
    const encoded = encodeURIComponent(shareMessage);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  // 3. Telegram Direct Share
  const handleTelegramShare = () => {
    sound.playClick();
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(
      autoJoinUrl
    )}&text=${encodeURIComponent(
      `🔒 Aura Drop Secret Room [${metadata.id}] (Self-destructs in ${timeStr})`
    )}`;
    window.open(telegramUrl, '_blank', 'noopener,noreferrer');
  };

  // 4. Instagram Share Action (Copy Formatted Caption & Open App/Web)
  const handleInstagramShare = () => {
    sound.playSuccess();
    navigator.clipboard.writeText(instagramCaption);
    setCopiedInstagram(true);
    setTimeout(() => setCopiedInstagram(false), 3000);

    // Open Instagram in new tab after quick toast delay
    setTimeout(() => {
      window.open('https://instagram.com', '_blank', 'noopener,noreferrer');
    }, 600);
  };

  // 5. Native Web Share API
  const handleNativeShare = async () => {
    sound.playClick();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Aura Drop Secret Room [${metadata.id}]`,
          text: `Join my secret room on Aura Drop (Self-destructs in ${timeStr}):`,
          url: autoJoinUrl,
        });
        return;
      } catch (err) {
        // User cancelled or share failed, fallback to copy
        console.log('Native share dismissed or failed:', err);
      }
    }

    // Fallback: Copy message
    navigator.clipboard.writeText(shareMessage);
    setCopiedFullMessage(true);
    setTimeout(() => setCopiedFullMessage(false), 2000);
  };

  // 6. X (Twitter) Share
  const handleTwitterShare = () => {
    sound.playClick();
    const tweetText = `🔒 Secret room on @AuraDrop: [${metadata.id}]\nSelf-destructs in ${timeStr}.\nAuto-join here: ${autoJoinUrl}`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  // 7. Email Share
  const handleEmailShare = () => {
    sound.playClick();
    const subject = encodeURIComponent(`Secret Room Invite: ${metadata.id}`);
    const body = encodeURIComponent(shareMessage);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // 8. Download QR Code PNG
  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    sound.playSuccess();
    const link = document.createElement('a');
    link.download = `AuraDrop-${metadata.id}-QR.png`;
    link.href = qrDataUrl;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-2.5 sm:p-6 overflow-y-auto">
      <div className="apple-frosted-glass rounded-3xl max-w-xl w-full p-4 sm:p-7 relative shadow-2xl border border-white/10 bg-[#0E1322]/98 text-white my-auto animate-in fade-in zoom-in-95 duration-150 max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 sm:mb-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl overflow-hidden p-[1px] bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 shadow-sm shrink-0">
              <Image
                src="/logo.png"
                alt="AuraDrop"
                width={40}
                height={40}
                className="w-full h-full object-cover rounded-2xl"
              />
            </div>
            <div>
              <h3 className="font-heading font-black text-base sm:text-lg text-white tracking-tight flex items-center gap-2">
                <span>1-Tap Social Share</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {isNoTimeLimit ? 'Permanent' : 'Auto-Join'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-normal">
                Friends join with 1 click — zero passwords to type
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Room Code & Password Sharing Card */}
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-3.5 sm:p-4 mb-4 shadow-xs">
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              <span>Room Credentials (For Manual Join)</span>
            </label>
            <span className="text-[10px] text-indigo-400 font-semibold">Share with friends</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Room ID */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-2.5 flex items-center justify-between shadow-xs">
              <div className="min-w-0 mr-2">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Room ID / Code</span>
                <span className="font-mono font-bold text-xs text-white truncate select-all block">
                  {metadata.id}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyRoomId}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                {copiedRoomId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                <span>{copiedRoomId ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Room Password */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-2.5 flex items-center justify-between shadow-xs">
              <div className="min-w-0 mr-2 flex-1">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Secret Password</span>
                <span className="font-mono text-xs text-white truncate select-all block">
                  {passphrase ? (showPassword ? passphrase : '••••••••••••') : 'None'}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {passphrase && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 text-slate-400 hover:text-white cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCopyPassphrase}
                  disabled={!passphrase}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0 disabled:opacity-40"
                >
                  {copiedPass ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  <span>{copiedPass ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Auto-Join Link Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 sm:p-4 mb-4 sm:mb-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Direct 1-Click Auto-Join Link:</span>
            </label>

            {/* Link Type Switcher */}
            <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-xl border border-white/10 text-[10px] font-semibold">
              <button
                type="button"
                onClick={() => setLinkType('hash')}
                title="Recommended: Key stays strictly on client (RFC 3986 fragment)"
                className={`px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                  linkType === 'hash'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Hash (#)
              </button>
              <button
                type="button"
                onClick={() => setLinkType('query')}
                title="Social-Safe: Prevents links being stripped by Instagram/WhatsApp cards"
                className={`px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                  linkType === 'query'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Social (?)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl p-2.5">
            <span className="font-mono text-xs text-white flex-1 truncate select-all">
              {autoJoinUrl}
            </span>
            <button
              onClick={handleCopyLink}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer tactile-btn shadow-xs shrink-0 ${
                copiedLink
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gradient-to-r from-indigo-600 to-cyan-500 hover:opacity-95 text-white'
              }`}
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-normal flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              Recipients will bypass the password screen and connect immediately.
            </span>
          </p>
        </div>

        {/* 1-Tap Social Sharing Grid */}
        <div className="mb-4 sm:mb-5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2.5">
            Share Directly to:
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* WhatsApp */}
            <button
              onClick={handleWhatsAppShare}
              className="flex items-center gap-3 p-3 rounded-2xl bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 text-white transition-all cursor-pointer group tactile-btn text-left shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-bold text-xs text-white">
                    WhatsApp
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold">1-Tap Send</span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  Share directly to chat or group
                </p>
              </div>
            </button>

            {/* Telegram */}
            <button
              onClick={handleTelegramShare}
              className="flex items-center gap-3 p-3 rounded-2xl bg-[#229ED9]/10 hover:bg-[#229ED9]/20 border border-[#229ED9]/30 text-white transition-all cursor-pointer group tactile-btn text-left shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-[#229ED9] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <Send className="w-5 h-5 -rotate-12" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-bold text-xs text-white">
                    Telegram
                  </span>
                  <span className="text-[10px] text-sky-400 font-semibold">1-Tap Send</span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  Post to channel, group or chat
                </p>
              </div>
            </button>

            {/* Instagram */}
            <button
              onClick={handleInstagramShare}
              className="flex items-center gap-3 p-3 rounded-2xl bg-[#E1306C]/10 hover:bg-[#E1306C]/20 border border-[#E1306C]/30 text-white transition-all cursor-pointer group tactile-btn text-left shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FD1D1D] via-[#E1306C] to-[#833AB4] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-bold text-xs text-white">
                    Instagram
                  </span>
                  <span className="text-[10px] text-pink-400 font-semibold">
                    {copiedInstagram ? 'Copied & Opening!' : 'Copy & Open'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  Paste into Story, Bio, or DM
                </p>
              </div>
            </button>

            {/* Native Share / AirDrop */}
            <button
              onClick={handleNativeShare}
              className="flex items-center gap-3 p-3 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-white transition-all cursor-pointer group tactile-btn text-left shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-bold text-xs text-white">
                    More Apps & AirDrop
                  </span>
                  <span className="text-[10px] text-indigo-400 font-semibold">
                    {copiedFullMessage ? 'Copied!' : 'System Share'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  AirDrop, Slack, Messages & more
                </p>
              </div>
            </button>

            {/* X / Twitter */}
            <button
              onClick={handleTwitterShare}
              className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all cursor-pointer group tactile-btn text-left shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform border border-white/10">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-bold text-xs text-white">
                    X (Twitter)
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">Post Tweet</span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  Broadcast secret room invite
                </p>
              </div>
            </button>

            {/* Email / SMS */}
            <button
              onClick={handleEmailShare}
              className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all cursor-pointer group tactile-btn text-left shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform border border-white/10">
                <Mail className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-bold text-xs text-white">
                    Email or SMS
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">Default Client</span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  Send via Mail or text message
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Live QR Code & Visual Banner Footer */}
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-3.5 sm:p-4">
          {qrDataUrl && (
            <div className="bg-white p-2 rounded-xl shadow-xs border border-white/20 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="Room Auto-Join QR"
                className="w-24 h-24 rounded-lg"
              />
            </div>
          )}

          <div className="flex-1 min-w-0 text-center sm:text-left">
            <h4 className="font-heading font-bold text-xs text-white mb-1 flex items-center justify-center sm:justify-start gap-1.5">
              <QrCode className="w-4 h-4 text-indigo-400" />
              <span>Smart QR Code Included</span>
            </h4>
            <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
              Anyone can scan this QR code with their phone camera to auto-join this room instantly.
            </p>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <button
                type="button"
                onClick={handleDownloadQr}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                <span>Save QR Image</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
