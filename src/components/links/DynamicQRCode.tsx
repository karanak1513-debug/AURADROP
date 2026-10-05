'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { QrCode, Copy, Check, Download, ExternalLink, Share2, Sparkles } from 'lucide-react';
import { sound } from '@/lib/sound';

interface DynamicQRCodeProps {
  bundleId: string;
  passphrase?: string;
  title?: string;
  qrColor?: string;
  bgColor?: string;
  size?: number;
  className?: string;
  showControls?: boolean;
}

export function DynamicQRCode({
  bundleId,
  passphrase = '',
  title = '',
  qrColor = '#0F172A',
  bgColor = '#FFFFFF',
  size = 320,
  className = '',
  showControls = true,
}: DynamicQRCodeProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(true);

  // Strictly encode the PUBLIC recipient URL (/l/[bundleId]), NEVER the creator studio!
  const getPublicUrl = () => {
    if (typeof window === 'undefined') return `https://auradrop.io/l/${bundleId}`;
    const origin = window.location.origin;
    const base = `${origin}/l/${encodeURIComponent(bundleId)}`;
    if (!passphrase) return base;
    return `${base}#key=${encodeURIComponent(passphrase)}`;
  };

  const publicUrl = getPublicUrl();

  // Generate QR code targeting public recipient URL
  useEffect(() => {
    let mounted = true;
    setIsGenerating(true);

    QRCode.toDataURL(publicUrl, {
      width: size * 2, // 2x for retina sharpness
      margin: 2,
      color: {
        dark: qrColor || '#0F172A',
        light: bgColor || '#FFFFFF',
      },
      errorCorrectionLevel: 'H', // High fault tolerance for mobile cameras
    })
      .then((url) => {
        if (mounted) {
          setQrDataUrl(url);
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        console.error('[DynamicQRCode] Generation error:', err);
        if (mounted) setIsGenerating(false);
      });

    return () => {
      mounted = false;
    };
  }, [publicUrl, qrColor, bgColor, size]);

  const handleCopyLink = () => {
    try {
      sound.playClick();
      navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    sound.playSuccess();
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `auradrop-linktree-${bundleId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      {/* QR Code Container */}
      <div className="relative p-4 rounded-3xl bg-white shadow-2xl border-4 border-white/20 transition-transform duration-300 hover:scale-[1.02]">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`QR code for ${title || bundleId}`}
            className="w-full h-auto max-w-[280px] sm:max-w-[320px] rounded-2xl block mx-auto aspect-square object-contain"
          />
        ) : (
          <div
            style={{ width: size, height: size }}
            className="flex flex-col items-center justify-center bg-slate-100 rounded-2xl animate-pulse text-slate-400 gap-2"
          >
            <QrCode className="w-10 h-10 animate-spin" />
            <span className="text-xs font-mono">Generating Public QR…</span>
          </div>
        )}

        {/* Scan Target Badge */}
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 shadow-lg text-[10px] font-mono font-bold text-indigo-300 flex items-center gap-1.5 whitespace-nowrap">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          <span>Scan opens /l/{bundleId}</span>
        </div>
      </div>

      {showControls && (
        <div className="w-full max-w-[320px] flex flex-col gap-2.5 mt-2">
          {/* Public Link Box */}
          <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-2 text-xs">
            <span className="font-mono text-slate-300 truncate text-[11px] select-all">
              {publicUrl}
            </span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white shrink-0 transition-colors cursor-pointer"
              title="Copy Public Link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all cursor-pointer active:scale-95"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadQr}
              disabled={!qrDataUrl || isGenerating}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-indigo-300" />
              <span>Download</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DynamicQRCode;
