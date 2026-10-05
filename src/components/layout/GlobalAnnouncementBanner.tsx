'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Radio,
  AlertTriangle,
  Info,
  CheckCircle2,
  Flame,
  X,
  Volume2,
  Bell,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { sound } from '@/lib/sound';

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'alert' | 'success' | 'emergency';
  priority: 'low' | 'normal' | 'urgent';
  createdAt: number;
  expiresAt: number;
  soundAlert: boolean;
  broadcastBy: string;
  active: boolean;
}

export function GlobalAnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Load dismissed IDs from sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = sessionStorage.getItem('aura_dismissed_announcements');
      if (stored) {
        setDismissedIds(new Set(JSON.parse(stored)));
      }
    } catch {
      // Ignore
    }
  }, []);

  const dismissAnnouncement = useCallback((id: string) => {
    sound.playClick?.();
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        sessionStorage.setItem('aura_dismissed_announcements', JSON.stringify(Array.from(next)));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  // Connect to SSE stream
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let eventSource: EventSource | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    const setupSSE = () => {
      try {
        eventSource = new EventSource('/api/announcements/stream');

        eventSource.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'initial' && Array.isArray(data.announcements)) {
              setAnnouncements(data.announcements);
            } else if (data.type === 'announcement_created' && data.announcement) {
              const ann: Announcement = data.announcement;
              setAnnouncements((prev) => {
                const exists = prev.some((a) => a.id === ann.id);
                if (exists) return prev;
                return [ann, ...prev];
              });
              if (ann.soundAlert) {
                sound.playAlert?.();
              }
            } else if (data.type === 'announcement_revoked' && data.revokedId) {
              setAnnouncements((prev) => prev.filter((a) => a.id !== data.revokedId));
            } else if (data.type === 'announcements_cleared') {
              setAnnouncements([]);
            }
          } catch {
            // Ignore parse errors
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // Poll every 12 seconds as fallback
          if (!fallbackInterval) {
            fallbackInterval = setInterval(fetchAnnouncements, 12_000);
          }
        };
      } catch {
        if (!fallbackInterval) {
          fallbackInterval = setInterval(fetchAnnouncements, 12_000);
        }
      }
    };

    const fetchAnnouncements = async () => {
      try {
        const res = await fetch('/api/announcements', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.announcements)) {
            setAnnouncements(data.announcements);
          }
        }
      } catch {
        // Ignore
      }
    };

    fetchAnnouncements();
    const sseTimer = setTimeout(() => {
      setupSSE();
    }, 1500);

    return () => {
      clearTimeout(sseTimer);
      if (eventSource) {
        eventSource.close();
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, []);

  // Filter out dismissed announcements
  const visibleAnnouncements = announcements.filter((a) => !dismissedIds.has(a.id));

  if (visibleAnnouncements.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex flex-col items-center pointer-events-none px-3 sm:px-6 pt-3 gap-2">
      {visibleAnnouncements.map((ann) => {
        const isUrgent = ann.priority === 'urgent' || ann.type === 'emergency' || ann.type === 'alert';
        const isWarning = ann.type === 'warning';
        const isSuccess = ann.type === 'success';

        let borderColor = 'border-indigo-500/40';
        let bgGradient = 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,27,75,0.92) 100%)';
        let glowColor = '0 10px 30px -5px rgba(99,102,241,0.3)';
        let badgeBg = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
        let IconComponent = Radio;

        if (isUrgent) {
          borderColor = 'border-rose-500/50';
          bgGradient = 'linear-gradient(135deg, rgba(30,10,18,0.96) 0%, rgba(69,10,10,0.92) 100%)';
          glowColor = '0 10px 35px -5px rgba(239,68,68,0.45)';
          badgeBg = 'bg-rose-500/25 text-rose-300 border-rose-500/40';
          IconComponent = Flame;
        } else if (isWarning) {
          borderColor = 'border-amber-500/50';
          bgGradient = 'linear-gradient(135deg, rgba(30,20,10,0.96) 0%, rgba(69,38,10,0.92) 100%)';
          glowColor = '0 10px 30px -5px rgba(245,158,11,0.35)';
          badgeBg = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
          IconComponent = AlertTriangle;
        } else if (isSuccess) {
          borderColor = 'border-emerald-500/50';
          bgGradient = 'linear-gradient(135deg, rgba(6,30,20,0.96) 0%, rgba(6,50,30,0.92) 100%)';
          glowColor = '0 10px 30px -5px rgba(16,185,129,0.35)';
          badgeBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
          IconComponent = CheckCircle2;
        }

        return (
          <div
            key={ann.id}
            role="alert"
            className="w-full max-w-3xl pointer-events-auto backdrop-blur-2xl rounded-2xl border p-3 sm:p-4 shadow-2xl transition-all duration-300 animate-in slide-in-from-top-4 fade-in"
            style={{
              background: bgGradient,
              boxShadow: glowColor,
              borderColor: borderColor,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              {/* Icon & Live indicator */}
              <div className="flex items-center gap-3 shrink-0 mt-0.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-inner ${
                    isUrgent ? 'border-rose-400/30 bg-rose-500/20' : 'border-indigo-400/30 bg-indigo-500/20'
                  }`}
                >
                  <IconComponent
                    className={`w-5 h-5 ${
                      isUrgent
                        ? 'text-rose-400 animate-pulse'
                        : isWarning
                        ? 'text-amber-400'
                        : isSuccess
                        ? 'text-emerald-400'
                        : 'text-indigo-400'
                    }`}
                  />
                </div>
              </div>

              {/* Message Content */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${badgeBg}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                    {isUrgent ? 'LIVE ALERT' : 'ANNOUNCEMENT'}
                  </span>
                  <h4 className="font-heading font-bold text-white text-sm tracking-tight truncate">
                    {ann.title}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono ml-auto">
                    {ann.broadcastBy}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal break-words">
                  {ann.message}
                </p>
              </div>

              {/* Dismiss button */}
              <button
                type="button"
                onClick={() => dismissAnnouncement(ann.id)}
                className="shrink-0 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Dismiss announcement"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
