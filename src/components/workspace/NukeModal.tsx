'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Flame, ShieldAlert, X, ArrowRight, Check } from 'lucide-react';

interface NukeModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  isNuking: boolean;
}

export function NukeModal({ onConfirm, onCancel, isNuking }: NukeModalProps) {
  const [sliderPos, setSliderPos] = useState(0); // 0 to 100
  const [isUnlocked, setIsUnlocked] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const handleSliderMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (isUnlocked || isNuking || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const offset = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const pct = Math.round((offset / rect.width) * 100);
    setSliderPos(pct);

    if (pct >= 88) {
      setIsUnlocked(true);
      setSliderPos(100);
      onConfirm();
    }
  };

  const handleMouseUp = () => {
    if (!isUnlocked) {
      setSliderPos(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94 }}
        className="w-full max-w-md bg-white/95 backdrop-blur-3xl rounded-3xl border border-rose-200/80 shadow-2xl p-6 space-y-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600 shadow-sm">
              <Flame className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Emergency Instant Purge</h3>
              <p className="text-xs text-rose-600 font-medium">Irreversible cryptographic zeroization</p>
            </div>
          </div>

          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning text */}
        <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100 text-xs text-slate-600 space-y-2 leading-relaxed">
          <p className="font-semibold text-rose-900 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>Multi-Pass Zero-Fill Decontamination</span>
          </p>
          <p>
            Executing this purge immediately destroys all cryptographic keys, zero-fills local memory buffers (DoD 5220.22-M simulation), purges the active room mesh, and dissolves 3D canvas geometries into particle dust.
          </p>
        </div>

        {/* Slide to Confirm Trigger */}
        <div className="space-y-2">
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center">
            Slide to Confirm Mechanical Detonation
          </label>

          <div
            ref={trackRef}
            onMouseMove={handleSliderMove}
            onTouchMove={handleSliderMove}
            onMouseUp={handleMouseUp}
            onTouchEnd={handleMouseUp}
            className="relative h-14 rounded-2xl bg-slate-100 border border-slate-200/80 p-1 flex items-center select-none overflow-hidden cursor-ew-resize"
          >
            {/* Fill Bar */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-rose-500 to-rose-600 rounded-2xl transition-all duration-75"
              style={{ width: `${sliderPos}%` }}
            />

            {/* Hint text */}
            <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-400 pointer-events-none">
              {isUnlocked ? 'ZEROIZING PLATFORM...' : 'Slide right to purge pod ➔'}
            </span>

            {/* Slider Knob */}
            <div
              className="absolute top-1 bottom-1 w-12 rounded-xl bg-white shadow-md border border-slate-200/60 flex items-center justify-center text-rose-600 transition-all duration-75 cursor-grab active:cursor-grabbing"
              style={{ left: `calc(${sliderPos}% * 0.85)` }}
            >
              {isUnlocked ? (
                <Check className="w-5 h-5 text-rose-600" />
              ) : (
                <ArrowRight className="w-5 h-5 text-rose-600" />
              )}
            </div>
          </div>
        </div>

        {/* Cancel Button */}
        <button
          type="button"
          onClick={onCancel}
          className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
        >
          Abort & Return to Safety
        </button>
      </motion.div>
    </div>
  );
}
