'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { sound } from '@/lib/sound';
import { AuraCanvas } from '@/components/canvas/AuraCanvas';

interface ZeroizeOverlayProps {
  reason?: string;
}

export function ZeroizeOverlay({ reason = 'MANUAL_DELETE' }: ZeroizeOverlayProps) {
  const router = useRouter();

  useEffect(() => {
    sound.playNuke();

    const t1 = setTimeout(() => {
      sound.playShred();
    }, 700);

    const t2 = setTimeout(() => {
      sound.playAlert();
    }, 1600);

    const t3 = setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', '/');
      }
      router.push('/');
    }, 3800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [router]);

  const readableReason =
    reason === 'MANUAL_PANIC_SWITCH'
      ? 'Room deleted manually'
      : reason === 'LIFECYCLE_TTL_EXPIRED'
      ? 'Self-destruct timer reached zero'
      : reason;

  return (
    <div className="fixed inset-0 z-50 bg-white/75 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
      {/* 3D Particle Vaporization Explosion in Background */}
      <AuraCanvas isVaporizing={true} />

      <div className="relative z-10 max-w-md w-full glass-panel border border-rose-200 p-8 rounded-3xl shadow-2xl shadow-rose-500/10 bg-white/95">
        <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 animate-pulse shadow-sm">
          <Sparkles className="w-8 h-8" />
        </div>

        <h1 className="font-heading font-black text-2xl text-slate-900 tracking-tight mb-1">
          Room Erased Completely
        </h1>
        <p className="text-xs font-semibold text-rose-600 tracking-wide mb-5">
          All files and chat messages have been permanently deleted
        </p>

        <p className="text-xs text-slate-500 mb-6 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60 font-medium">
          Trigger: <span className="font-bold text-slate-900">{readableReason}</span>
        </p>

        <div className="text-left text-xs space-y-2.5 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/60 text-slate-700 shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>All uploaded files permanently shredded and erased</span>
          </div>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Server memory and temp files completely wiped</span>
          </div>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Room code and link destroyed forever</span>
          </div>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Browser memory cleared with zero trace</span>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500 font-semibold">
          <span className="inline-block w-2 h-2 rounded-full bg-rose-600 animate-ping" />
          <span>Returning to home page...</span>
        </div>
      </div>
    </div>
  );
}
