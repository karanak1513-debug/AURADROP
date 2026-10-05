'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  HardDrive,
  Flame,
  Shield,
  Key,
  Dices,
  Copy,
  Check,
  Eye,
  EyeOff,
  ArrowRight,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { AuraCanvas } from '@/components/canvas/AuraCanvas';
import { generateNATORoomId, generateSecurePassphrase, generateSalt } from '@/lib/crypto';
import { PodTTL } from '@/types/vault';
import { sound } from '@/lib/sound';

export default function DropLauncherPage() {
  const router = useRouter();

  const [dropId, setDropId] = useState<string>(() => generateNATORoomId());
  const [passphrase, setPassphrase] = useState<string>(() => generateSecurePassphrase());
  const [ttl, setTtl] = useState<PodTTL>('1h');
  const [burnOnDownload, setBurnOnDownload] = useState<boolean>(true);
  const [showPassphrase, setShowPassphrase] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);

  const handleCreateDrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dropId.trim() || !passphrase.trim()) return;

    try {
      setIsDeploying(true);
      sound.playClick?.();

      const salt = generateSalt();
      const res = await fetch('/api/pods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: dropId.trim().toUpperCase(),
          salt,
          ttl,
          burnOnDownload,
          burnOnEmpty: true,
        }),
      });

      if (!res.ok) throw new Error('Failed to create drop pod');

      sound.playSuccess?.();
      router.push(`/drop/${encodeURIComponent(dropId.trim().toUpperCase())}#key=${encodeURIComponent(passphrase.trim())}`);
    } catch (err) {
      console.error(err);
      setIsDeploying(false);
      sound.playAlert?.();
      alert('Could not initialize drop pod. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col aura-ambient relative overflow-hidden">
      <AuraCanvas />
      <Navbar />

      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-12 relative z-10 flex flex-col justify-center">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-4 shadow-sm">
            <HardDrive className="w-7 h-7" />
          </div>
          <h1 className="font-heading font-black text-3xl text-slate-900 tracking-tight">
            Launch Secret File Drop
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            100% Anonymous · Client-Side AES-256-GCM · Burn-on-Download
          </p>
        </div>

        <div className="apple-frosted-glass apple-frosted-card rounded-3xl p-6 sm:p-8 shadow-xl">
          <form onSubmit={handleCreateDrop} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">Drop Code</label>
                <button
                  type="button"
                  onClick={() => setDropId(generateNATORoomId())}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <Dices className="w-3.5 h-3.5" />
                  <span>Randomize</span>
                </button>
              </div>
              <input
                type="text"
                value={dropId}
                onChange={(e) => setDropId(e.target.value.toUpperCase())}
                className="w-full apple-frosted-input rounded-2xl px-4 py-3 text-xs sm:text-sm font-mono font-bold text-slate-900 outline-none uppercase tracking-wider"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">Secret Encryption Password</label>
                <button
                  type="button"
                  onClick={() => setPassphrase(generateSecurePassphrase())}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
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
                  className="w-full apple-frosted-input rounded-2xl px-4 py-3 text-xs sm:text-sm font-mono text-slate-900 outline-none pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassphrase(!showPassphrase)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Self-Destruct Lifetime</label>
              <div className="grid grid-cols-4 gap-2">
                {(['15m', '1h', '6h', '24h'] as PodTTL[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTtl(t)}
                    className={`py-2 px-3 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                      ttl === t
                        ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white border-transparent shadow-xs'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    {t === '15m' ? '15m' : t === '1h' ? '1 Hour' : t === '6h' ? '6 Hours' : '24 Hours'}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 cursor-pointer hover:bg-slate-100/70 transition-colors">
              <input
                type="checkbox"
                checked={burnOnDownload}
                onChange={(e) => setBurnOnDownload(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 accent-indigo-600"
              />
              <div>
                <p className="text-xs font-bold text-slate-800">Burn Files on Download</p>
                <p className="text-[11px] text-slate-500">File is zeroized immediately after recipient download.</p>
              </div>
            </label>

            <button
              type="submit"
              disabled={isDeploying}
              className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-heading font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-500/25 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isDeploying ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Initializing Drop Pod…</span>
                </>
              ) : (
                <>
                  <span>Open Secret Drop Pod</span>
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
