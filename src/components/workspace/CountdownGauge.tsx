'use client';

import React from 'react';
import { Clock } from 'lucide-react';

interface CountdownGaugeProps {
  remainingSeconds: number;
  totalSeconds: number;
  isCritical: boolean;
}

export function CountdownGauge({ remainingSeconds, totalSeconds, isCritical }: CountdownGaugeProps) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = totalSeconds > 0 ? Math.max(0, Math.min(1, remainingSeconds / totalSeconds)) : 0;
  const strokeDashoffset = circumference - progressRatio * circumference;

  const formatTime = (secs: number) => {
    if (secs <= 0) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Color shifting: Indigo -> Amber -> Liquid Coral
  const strokeColor = isCritical
    ? '#F43F5E' // Warm Coral
    : progressRatio < 0.3
    ? '#F59E0B' // Amber
    : '#6366F1'; // Electric Indigo

  return (
    <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/90 shadow-sm">
      <div className="relative w-11 h-11 flex items-center justify-center">
        <svg className="w-11 h-11 -rotate-90" viewBox="0 0 52 52">
          {/* Background Ring */}
          <circle
            cx="26"
            cy="26"
            r={radius}
            className="stroke-slate-100"
            strokeWidth="3.5"
            fill="transparent"
          />
          {/* Progress Ring */}
          <circle
            cx="26"
            cy="26"
            r={radius}
            stroke={strokeColor}
            strokeWidth="3.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>

        <Clock
          className={`w-3.5 h-3.5 absolute transition-colors ${
            isCritical ? 'text-rose-500 animate-pulse' : 'text-slate-500'
          }`}
        />
      </div>

      <div className="flex flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Auto Self-Destruct
        </span>
        <span
          className={`text-xs font-mono font-bold tracking-tight ${
            isCritical ? 'text-rose-600 animate-pulse' : 'text-slate-800'
          }`}
        >
          {formatTime(remainingSeconds)}
        </span>
      </div>
    </div>
  );
}
