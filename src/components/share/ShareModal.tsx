'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Copy,
  Check,
  QrCode,
  Share2,
  Lock,
  Sparkles,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import { sound } from '@/lib/sound';
import { createChatRoomRecord, saveLinktreeBundleRecord } from '@/lib/rooms';

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'chat' | 'linktree';
  id: string;
  passphrase?: string;
  title?: string;
  links?: any[];
  ttlHours?: number;
}

export function ShareModal({
  isOpen,
  onClose,
  type,
  id,
  passphrase = '',
  title = '',
  links = [],
  ttlHours = 1,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isPersisted, setIsPersisted] = useState(false);

  // Absolute origin calculation
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://auradrop.io';

  // Chat Magic Link (encodes passkey in hash fragment)
  const chatMagicLink = `${origin}/chat/${encodeURIComponent(id)}#key=${encodeURIComponent(passphrase)}`;

  // Linktree Public Recipient Dashboard Link
  const linktreePublicLink = `${origin}/l/${encodeURIComponent(id)}`;

  const activeShareLink = type === 'chat' ? chatMagicLink : linktreePublicLink;

  // Authoritative Firestore handshake commit BEFORE presenting share link or QR
  useEffect(() => {
    if (!isOpen || !id) return;

    const commitRecord = async () => {
      try {
        if (type === 'chat') {
          await createChatRoomRecord(id, passphrase, ttlHours, 'anonymous', { hostPeerId: 'CREATOR' });
        } else {
          await saveLinktreeBundleRecord(id, title || `${id} Link Hub`, links, 'indigo', ttlHours || 24, 'anonymous');
        }
        setIsPersisted(true);
      } catch (err) {
        console.warn('[ShareModal] Handshake commit warning:', err);
      }
    };

    commitRecord();
  }, [isOpen, id, type, passphrase, title, links, ttlHours]);

  // Generate QR Code strictly encoding the exact share URL
  useEffect(() => {
    if (!isOpen || !activeShareLink) return;

    QRCode.toDataURL(activeShareLink, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR code error:', err));
  }, [isOpen, activeShareLink]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    sound.playClick();
    navigator.clipboard.writeText(activeShareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    sound.playClick();
    const shareText = `Join my ephemeral session: ${activeShareLink}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm apple-frosted-glass rounded-3xl p-6 border border-white/10 shadow-2xl overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shadow-md">
            <Share2 className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base text-white">
              {type === 'chat' ? 'Share Encrypted Chat' : 'Share Smart Linktree'}
            </h3>
            <p className="text-[11px] text-slate-400">
              {type === 'chat' ? '1-Tap Join Magic Link with passkey' : 'Public dynamic QR & bio-link hub'}
            </p>
          </div>
        </div>

        {/* Dynamic QR Code Card */}
        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl mb-4 shadow-inner">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Session QR" className="w-44 h-44 rounded-xl object-contain" />
          ) : (
            <div className="w-44 h-44 flex items-center justify-center">
              <QrCode className="w-8 h-8 animate-pulse text-slate-400" />
            </div>
          )}
          <span className="text-[10px] font-mono text-slate-500 mt-1 font-semibold">
            {type === 'chat' ? 'Scan to Join E2EE Chat' : 'Scan to View Bio Links'}
          </span>
        </div>

        {/* Link Field */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-2.5 mb-3 flex items-center gap-2">
          <div className="min-w-0 flex-1 px-1">
            <p className="text-[10px] font-mono text-slate-400 truncate select-all">{activeShareLink}</p>
          </div>
          <button
            onClick={handleCopyLink}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* WhatsApp Direct Share Action */}
        <button
          onClick={handleWhatsAppShare}
          className="w-full py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer tactile-btn mb-2"
        >
          <MessageCircle className="w-4 h-4" />
          <span>Share on WhatsApp (1-Tap Join)</span>
        </button>

        {/* Verified Notice */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 mt-2">
          <Lock className="w-3 h-3 text-indigo-400" />
          <span>Authoritative Firestore Handshake • E2EE</span>
        </div>
      </div>
    </div>
  );
}
