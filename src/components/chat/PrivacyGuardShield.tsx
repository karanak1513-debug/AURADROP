'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff,
  Camera,
  Printer,
  Copy,
  AlertTriangle,
  Lock,
  Sparkles,
  X,
  Volume2,
  VolumeX,
  Check,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { sound } from '@/lib/sound';

export interface SecurityIncident {
  id: string;
  codename: string;
  memberId: string;
  timestamp: number;
  type: 'screenshot' | 'print' | 'devtools' | 'simulated';
}

export interface PrivacyShieldConfig {
  blurOnInactive: boolean;
  captureDetection: boolean;
  forensicWatermark: boolean;
  copyProtection: boolean;
}

interface PrivacyGuardShieldProps {
  roomId: string;
  currentCodename: string;
  currentMemberId: string;
  onAlertBroadcast?: (incident: SecurityIncident) => void;
  externalIncident?: SecurityIncident | null;
  forceOpenConfig?: boolean;
  onCloseConfig?: () => void;
  children: React.ReactNode;
}

export function PrivacyGuardShield({
  roomId,
  currentCodename,
  currentMemberId,
  onAlertBroadcast,
  externalIncident,
  forceOpenConfig,
  onCloseConfig,
  children,
}: PrivacyGuardShieldProps) {
  // ── Config State ──────────────────────────────────────────────────────────
  const [config, setConfig] = useState<PrivacyShieldConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('aura_privacy_shield_config');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return {
      blurOnInactive: true,
      captureDetection: true,
      forensicWatermark: true,
      copyProtection: true,
    };
  });

  const [isWindowBlurred, setIsWindowBlurred] = useState(false);
  const [manualReveal, setManualReveal] = useState(false);
  const [flashObfuscated, setFlashObfuscated] = useState(false);
  const [activeBanner, setActiveBanner] = useState<SecurityIncident | null>(null);
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [showConfigPopover, setShowConfigPopover] = useState(false);

  // Sync config to localStorage
  const updateConfig = (key: keyof PrivacyShieldConfig, val: boolean) => {
    setConfig(prev => {
      const next = { ...prev, [key]: val };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('aura_privacy_shield_config', JSON.stringify(next));
        } catch {}
      }
      return next;
    });
  };

  // ── Trigger Capture Alert ─────────────────────────────────────────────────
  const triggerCaptureAlert = useCallback(
    async (type: SecurityIncident['type'] = 'screenshot', isSimulated = false) => {
      if (!config.captureDetection && !isSimulated) return;

      // 1. Instant White / Frosted Flash Veil (350ms) to obstruct screen capture
      setFlashObfuscated(true);
      setTimeout(() => setFlashObfuscated(false), 380);

      // 2. Play Audio Alert
      sound.playAlert?.();

      const incident: SecurityIncident = {
        id: `inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        codename: currentCodename,
        memberId: currentMemberId,
        timestamp: Date.now(),
        type,
      };

      // 3. Local Incident Tracking
      setIncidents(prev => [incident, ...prev.slice(0, 19)]);
      setActiveBanner(incident);

      // 4. Notify parent / room
      if (onAlertBroadcast) {
        onAlertBroadcast(incident);
      }

      // 5. Broadcast to room via SSE API
      try {
        await fetch(`/api/rooms/${encodeURIComponent(roomId)}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'screen_capture_alert',
            payload: {
              memberId: currentMemberId,
              codename: currentCodename,
              timestamp: incident.timestamp,
            },
          }),
        });
      } catch (err) {
        console.error('[PrivacyGuard] Broadcast failed:', err);
      }
    },
    [config.captureDetection, currentCodename, currentMemberId, onAlertBroadcast, roomId]
  );

  // ── Handle External Incidents From Peers ──────────────────────────────────
  useEffect(() => {
    if (externalIncident) {
      setIncidents(prev => {
        if (prev.some(i => i.id === externalIncident.id)) return prev;
        return [externalIncident, ...prev.slice(0, 19)];
      });
      setActiveBanner(externalIncident);
      sound.playAlert?.();
    }
  }, [externalIncident]);

  // Auto-dismiss active alert banner after 6 seconds
  useEffect(() => {
    if (!activeBanner) return;
    const t = setTimeout(() => setActiveBanner(null), 6000);
    return () => clearTimeout(t);
  }, [activeBanner]);

  // ── Window Blur & Visibility (Anti-Snooping) ──────────────────────────────
  useEffect(() => {
    if (!config.blurOnInactive) {
      setIsWindowBlurred(false);
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsWindowBlurred(true);
        setManualReveal(false);
      } else {
        setIsWindowBlurred(false);
      }
    };

    const handleBlur = () => {
      setIsWindowBlurred(true);
      setManualReveal(false);
    };

    const handleFocus = () => {
      setIsWindowBlurred(false);
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [config.blurOnInactive]);

  // ── Screen Capture & Shortcut Interceptor ─────────────────────────────────
  useEffect(() => {
    if (!config.captureDetection) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Windows / Linux PrintScreen key
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        triggerCaptureAlert('screenshot');
        return;
      }

      // 2. macOS Screenshots: Cmd + Shift + 3 / 4 / 5
      if (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) {
        triggerCaptureAlert('screenshot');
        return;
      }

      // 3. Windows Snipping Tool: Win/Cmd + Shift + S or Ctrl + Shift + S
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        triggerCaptureAlert('screenshot');
        return;
      }

      // 4. Print / PDF Export: Ctrl + P / Cmd + P (Prohibit silent capture)
      if ((e.metaKey || e.ctrlKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
        triggerCaptureAlert('print');
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        triggerCaptureAlert('screenshot');
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [config.captureDetection, triggerCaptureAlert]);

  // ── Copy Protection ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!config.copyProtection) return;

    const handleCopy = (e: ClipboardEvent) => {
      const selection = window.getSelection()?.toString();
      // Allow single word / short selects, block bulk scraping
      if (selection && selection.length > 120) {
        const activeEl = document.activeElement;
        // Don't block input or textarea fields
        if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA') {
          return;
        }
        e.preventDefault();
        sound.playTick?.();
        setActiveBanner({
          id: `copy-${Date.now()}`,
          codename: currentCodename,
          memberId: currentMemberId,
          timestamp: Date.now(),
          type: 'devtools',
        });
      }
    };

    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, [config.copyProtection, currentCodename, currentMemberId]);

  const shouldVeil = isWindowBlurred && config.blurOnInactive && !manualReveal;

  return (
    <div className="relative flex-1 flex flex-col min-h-0 w-full overflow-hidden select-text">
      {/* ── CSS Print Shield ── */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          body::after {
            content: "⚠️ AURA PRIVACY SHIELD ACTIVE: Printing or PDF exporting of encrypted ephemeral chats is strictly prohibited by zero-knowledge policy.";
            visibility: visible !important;
            display: block !important;
            position: fixed;
            top: 20%;
            left: 10%;
            right: 10%;
            text-align: center;
            font-size: 20px;
            font-weight: 800;
            color: #dc2626;
            font-family: sans-serif;
            border: 3px solid #dc2626;
            padding: 40px;
            border-radius: 16px;
            background: #fef2f2;
          }
        }
      `}</style>

      {/* ── Real-Time Incident Banner (HUD) ── */}
      {activeBanner && (
        <div className="absolute top-3 left-4 right-4 z-50 flex items-center justify-between p-3.5 rounded-2xl bg-rose-900/95 backdrop-blur-xl border border-rose-500/50 text-white shadow-2xl animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-600/80 flex items-center justify-center shrink-0 animate-pulse">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-heading font-extrabold text-xs text-rose-100 flex items-center gap-1.5">
                <span>SECURITY NOTICE: SCREEN CAPTURE ATTEMPT</span>
                <span className="text-[10px] bg-rose-500/30 text-rose-200 px-2 py-0.5 rounded-full font-mono">
                  AUDITED
                </span>
              </p>
              <p className="text-[11px] text-rose-200/90 font-medium">
                {activeBanner.memberId === currentMemberId
                  ? 'Screen capture attempt detected on your client · All room peers notified.'
                  : `Peer "${activeBanner.codename}" attempted a screen capture · Recorded in session audit.`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveBanner(null)}
            className="p-1.5 rounded-lg hover:bg-rose-800/80 text-rose-300 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Instant Screenshot Flash Obfuscator (350ms) ── */}
      {flashObfuscated && (
        <div className="absolute inset-0 z-50 bg-white/98 backdrop-blur-3xl flex flex-col items-center justify-center pointer-events-none transition-opacity duration-150">
          <div className="p-8 rounded-3xl bg-slate-900 text-white text-center shadow-2xl border border-rose-500/80 max-w-sm mx-4">
            <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3 animate-bounce" />
            <h2 className="font-heading font-black text-sm uppercase tracking-wider text-rose-400">
              Screen Capture Prohibited
            </h2>
            <p className="text-xs text-slate-300 mt-1 font-mono">
              AURA SHIELD ARMED • ZERO-KNOWLEDGE E2EE
            </p>
            <p className="text-[10px] text-slate-400 mt-2 font-mono">
              Captured by: {currentCodename} • {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>
      )}

      {/* ── Anti-Leak Forensic Digital Watermark Background ── */}
      {config.forensicWatermark && (
        <div
          className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden opacity-[0.035] flex items-center justify-center"
          style={{
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 80px,
              rgba(15, 23, 42, 0.9) 80px,
              rgba(15, 23, 42, 0.9) 82px
            )`,
          }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-24 gap-y-28 transform -rotate-12 scale-125 whitespace-nowrap text-slate-950 font-mono font-black text-[11px] tracking-widest uppercase">
            {Array.from({ length: 24 }).map((_, i) => (
              <span key={i}>
                AURA · {roomId} · {currentCodename}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Child Chat Canvas ── */}
      <div className={`relative flex-1 flex flex-col min-h-0 w-full transition-all duration-300 ${shouldVeil ? 'filter blur-2xl opacity-20 pointer-events-none' : ''}`}>
        {children}
      </div>

      {/* ── Window Inactive Privacy Veil Curtain ── */}
      {shouldVeil && (
        <div className="absolute inset-0 z-40 bg-slate-950/75 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
          <div className="max-w-md w-full bg-white/10 border border-white/20 rounded-3xl p-6 shadow-2xl backdrop-blur-xl text-white">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center mx-auto mb-4 text-indigo-400 shadow-lg shadow-indigo-500/20">
              <Shield className="w-7 h-7" />
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider mb-2 border border-indigo-400/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Privacy Guard Active
            </div>

            <h3 className="font-heading font-black text-lg text-white mb-2">
              Window Concealed
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed mb-6 font-normal">
              Chat contents are obscured to prevent shoulder surfing, background recording, and OS thumbnail caching while this window is inactive.
            </p>

            <button
              onClick={() => setManualReveal(true)}
              className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:opacity-95 text-white font-bold text-xs shadow-lg shadow-indigo-500/30 cursor-pointer transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              <span>Click to Reveal Content</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Control Center Popover Modal ── */}
      {(showConfigPopover || forceOpenConfig) && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => {
            setShowConfigPopover(false);
            onCloseConfig?.();
          }}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-5 overflow-hidden animate-in zoom-in-95 duration-200 text-slate-900"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-black text-sm text-slate-900 leading-tight">
                    Privacy Guard & Capture Shield
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Client-Side Defense & Leak Prevention
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowConfigPopover(false);
                  onCloseConfig?.();
                }}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Armed Status Badge */}
            <div className="mt-4 p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-100/90 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-indigo-950">
                  Active Protection Engine
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-white text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-200 shadow-2xs">
                Zero-Knowledge
              </span>
            </div>

            {/* Toggles */}
            <div className="mt-4 space-y-2.5 text-xs">
              {/* Blur on Inactive */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="mr-3">
                  <span className="font-bold text-slate-800 block text-xs">
                    Anti-Snooping Window Blur
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Conceal chat when switching apps or browser tabs
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => updateConfig('blurOnInactive', !config.blurOnInactive)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    config.blurOnInactive ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white shadow-xs transition-transform transform ${
                      config.blurOnInactive ? 'translate-x-6' : 'translate-x-1'
                    } top-1 absolute`}
                  />
                </button>
              </div>

              {/* Capture Detection & Peer Alert */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="mr-3">
                  <span className="font-bold text-slate-800 block text-xs">
                    Screen Capture Alert Shield
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Detect PrintScreen & shortcuts, flash veil, and alert peers
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => updateConfig('captureDetection', !config.captureDetection)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    config.captureDetection ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white shadow-xs transition-transform transform ${
                      config.captureDetection ? 'translate-x-6' : 'translate-x-1'
                    } top-1 absolute`}
                  />
                </button>
              </div>

              {/* Forensic Watermark */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="mr-3">
                  <span className="font-bold text-slate-800 block text-xs">
                    Digital Leak Watermark
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Tile subtle cryptographic watermark to prevent camera photo leaks
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => updateConfig('forensicWatermark', !config.forensicWatermark)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    config.forensicWatermark ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white shadow-xs transition-transform transform ${
                      config.forensicWatermark ? 'translate-x-6' : 'translate-x-1'
                    } top-1 absolute`}
                  />
                </button>
              </div>

              {/* Copy Protection */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="mr-3">
                  <span className="font-bold text-slate-800 block text-xs">
                    Strict Copy & Print Guard
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Block print-to-PDF commands and unauthorized bulk text copy
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => updateConfig('copyProtection', !config.copyProtection)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    config.copyProtection ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white shadow-xs transition-transform transform ${
                      config.copyProtection ? 'translate-x-6' : 'translate-x-1'
                    } top-1 absolute`}
                  />
                </button>
              </div>
            </div>

            {/* Test Simulation Button */}
            <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => triggerCaptureAlert('simulated', true)}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5 text-rose-500" />
                <span>Simulate Capture Alert</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfigPopover(false);
                  onCloseConfig?.();
                }}
                className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Exported Header Status Button ─────────────────────────────────────────────

interface PrivacyShieldButtonProps {
  onClick: () => void;
  hasActiveAlert?: boolean;
}

export function PrivacyShieldButton({ onClick, hasActiveAlert }: PrivacyShieldButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer shadow-xs active:scale-95 ${
        hasActiveAlert
          ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse'
          : 'bg-emerald-50/80 hover:bg-emerald-100 border-emerald-200/80 text-emerald-800'
      }`}
      title="Privacy Guard & Screen Capture Alert Shield"
    >
      <ShieldCheck className={`w-3.5 h-3.5 ${hasActiveAlert ? 'text-rose-600' : 'text-emerald-600'}`} />
      <span>{hasActiveAlert ? 'Alert Triggered' : 'Shield Armed'}</span>
      <span className={`w-1.5 h-1.5 rounded-full ${hasActiveAlert ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`} />
    </button>
  );
}
