'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  QrCode,
  Shield,
  Key,
  Dices,
  ArrowRight,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
  Infinity as InfinityIcon,
  Clock,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { DynamicAuraCanvas as AuraCanvas } from '@/components/canvas/DynamicAuraCanvas';
import { generateNATORoomId, generateSecurePassphrase, generateSalt } from '@/lib/crypto';
import { PodTTL } from '@/types/vault';
import { sound } from '@/lib/sound';

export default function LinksLauncherPage() {
  const router = useRouter();

  const [linkId, setLinkId] = useState<string>(() => generateNATORoomId());
  const [passphrase, setPassphrase] = useState<string>(() => generateSecurePassphrase());
  const [ttl, setTtl] = useState<PodTTL>('never');
  const [showPassphrase, setShowPassphrase] = useState<boolean>(false);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);

  const handleCreateLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkId.trim() || !passphrase.trim()) return;

    try {
      setIsDeploying(true);
      sound.playClick?.();

      const salt = generateSalt();
      const res = await fetch('/api/pods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: linkId.trim().toUpperCase(),
          salt,
          ttl,
          burnOnDownload: false,
          burnOnEmpty: ttl !== 'never',
        }),
      });

      if (!res.ok) throw new Error('Failed to create link hub');

      sound.playSuccess?.();
      router.push(`/links/${encodeURIComponent(linkId.trim().toUpperCase())}#key=${encodeURIComponent(passphrase.trim())}`);
    } catch (err) {
      console.error(err);
      setIsDeploying(false);
      sound.playAlert?.();
      alert('Could not initialize link hub. Please try again.');
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#07090E] text-slate-100 flex flex-col aura-ambient relative overflow-hidden">
      <AuraCanvas />
      <Navbar />

      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 sm:py-12 relative z-10 flex flex-col justify-center">
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-14 h-14 rounded-3xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mx-auto mb-4 shadow-xl shadow-purple-500/20">
            <QrCode className="w-7 h-7" />
          </div>
          <h1 className="font-heading font-black text-2xl sm:text-3xl text-white tracking-tight">
            Launch Smart Linktree & QR Hub
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Dynamic QR Codes · Ephemeral or Permanent Links · Google Cloud Sync
          </p>
        </div>

        <div className="apple-frosted-glass rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/10">
          <form onSubmit={handleCreateLinks} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300">Link Hub Codename</label>
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick?.();
                    setLinkId(generateNATORoomId());
                  }}
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
                className="w-full apple-frosted-input rounded-2xl px-4 py-3 text-xs sm:text-sm font-mono font-bold text-white outline-none uppercase tracking-wider"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300">Secret Encryption Password</label>
                <button
                  type="button"
                  onClick={() => {
                    sound.playKey?.();
                    setPassphrase(generateSecurePassphrase());
                  }}
                  className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
                >
                  <Dices className="w-3.5 h-3.5" />
                  <span>Generate</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassphrase ? 'text' : 'password'}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="w-full apple-frosted-input rounded-2xl px-4 py-3 text-xs sm:text-sm font-mono text-white outline-none pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassphrase(!showPassphrase)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300">Hub Lifetime</label>
                <span className="text-[10px] text-purple-300 font-bold bg-purple-500/15 px-2 py-0.5 rounded-full border border-purple-500/30">
                  Recommended for Social Bio
                </span>
              </div>

              {/* Primary: No Time Limit (Permanent) */}
              <button
                type="button"
                onClick={() => {
                  sound.playClick?.();
                  setTtl('never');
                }}
                className={`w-full p-3 mb-2 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between shadow-xs ${
                  ttl === 'never'
                    ? 'bg-purple-500/20 border-purple-400 text-white ring-2 ring-purple-500/30'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm ${
                      ttl === 'never' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white/10 text-purple-300'
                    }`}
                  >
                    <InfinityIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-heading font-extrabold text-xs text-white block">
                      No Time Limit (Permanent)
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Stays active indefinitely · Ideal for Instagram Bio, TikTok, Posters & QR
                    </span>
                  </div>
                </div>
                {ttl === 'never' && (
                  <span className="text-[10px] font-bold bg-purple-600 text-white px-2 py-0.5 rounded-full shrink-0">
                    Active
                  </span>
                )}
              </button>

              {/* Ephemeral Test Durations */}
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold mb-1.5">
                <span>Or select disposable test timer:</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(['24h', '6h', '1h', '15m'] as PodTTL[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      sound.playClick?.();
                      setTtl(t);
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                      ttl === t
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-transparent shadow-xs'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                    }`}
                  >
                    {t === '15m' ? '15m' : t === '1h' ? '1h' : t === '6h' ? '6h' : '24h'}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isDeploying}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-heading font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer tactile-btn"
            >
              {isDeploying ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating Dynamic QR Studio…</span>
                </>
              ) : (
                <>
                  <span>Enter Linktree Studio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
