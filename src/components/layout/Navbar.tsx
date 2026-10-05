'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Volume2,
  VolumeX,
  ShieldCheck,
  Trash2,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  ChevronDown,
  X,
  Share2,
} from 'lucide-react';
import { sound } from '@/lib/sound';
import { UserSessionPill } from '@/components/auth/UserSessionPill';

interface NavbarProps {
  podId?: string;
  passphrase?: string;
  isZeroized?: boolean;
  onPurge?: () => void;
  onOpenShare?: () => void;
}

export function Navbar({ podId, passphrase, isZeroized, onPurge, onOpenShare }: NavbarProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [showFlyout, setShowFlyout] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Copy feedback states
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const flyoutRef = useRef<HTMLDivElement>(null);

  // Click outside to close flyout
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (flyoutRef.current && !flyoutRef.current.contains(event.target as Node)) {
        setShowFlyout(false);
      }
    };

    if (showFlyout) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFlyout]);

  const handleToggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
    if (!muted) {
      sound.playClick();
    }
  };

  const getFullShareUrl = () => {
    if (typeof window === 'undefined') return '';
    let url = window.location.href;
    if (!url.includes('#key=') && passphrase && podId) {
      url = `${window.location.origin}/pod/${podId}#key=${encodeURIComponent(passphrase)}`;
    }
    return url;
  };

  const handleCopyCode = () => {
    if (!podId) return;
    sound.playClick();
    navigator.clipboard.writeText(podId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyPass = () => {
    if (!passphrase) return;
    sound.playClick();
    navigator.clipboard.writeText(passphrase);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2000);
  };

  const handleCopyLink = () => {
    const url = getFullShareUrl();
    if (!url) return;
    sound.playClick();
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyAll = () => {
    if (!podId) return;
    sound.playClick();
    const shareText = `AuraDrop Secure Pod: ${podId}\nKey: ${passphrase || 'None'}\nDirect link: ${getFullShareUrl()}`;
    navigator.clipboard.writeText(shareText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  return (
    <header className="sticky top-0 z-40 px-2.5 sm:px-6 lg:px-8 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 transition-all">
      <div className="max-w-6xl mx-auto glass-pill rounded-full px-3 sm:px-5 py-1.5 sm:py-2 flex items-center justify-between shadow-[0_15px_35px_-10px_rgba(0,0,0,0.6)] border border-white/10 relative">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            onClick={() => sound.playClick()}
            className="flex items-center gap-2 sm:gap-2.5 group cursor-pointer"
          >
            <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden p-[1px] bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 shadow-md group-hover:scale-105 transition-all shrink-0">
              <Image
                src="/logo.png"
                alt="AuraDrop Logo"
                width={32}
                height={32}
                className="w-full h-full object-cover rounded-full"
                priority
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-heading font-black text-sm sm:text-lg tracking-tight text-white">
                  Aura<span className="text-indigo-400 font-extrabold">Drop</span>
                </span>
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              </div>
            </div>
          </Link>

          {/* Active Room Badge & Flyout Trigger */}
          {podId && (
            <div className="relative" ref={flyoutRef}>
              <div className="flex items-center gap-1 sm:gap-1.5 ml-1 sm:ml-3 pl-1 sm:pl-3 border-l border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setShowFlyout(!showFlyout);
                  }}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer tactile-btn shadow-xs shrink-0 ${
                    showFlyout
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/25'
                      : 'bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                  }`}
                  title="Click to view Room Code and Secret Password"
                >
                  <Key className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="font-mono font-bold whitespace-nowrap max-w-[65px] sm:max-w-none truncate text-[11px] sm:text-xs">
                    {podId}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-slate-400 shrink-0 transition-transform duration-200 ${showFlyout ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Room Credentials Flyout */}
              {showFlyout && (
                <div className="fixed inset-x-3 top-16 sm:absolute sm:top-full sm:left-0 sm:inset-x-auto sm:w-96 glass-panel rounded-3xl p-4 sm:p-5 shadow-2xl border border-white/10 bg-[#0E1322]/98 backdrop-blur-3xl z-50 animate-in fade-in zoom-in-95 duration-150 max-h-[85dvh] overflow-y-auto">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-xs">
                        <Share2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-heading font-bold text-sm text-white tracking-tight">
                          Room Access Details
                        </h4>
                        <p className="text-[11px] text-slate-400 font-normal">
                          Share with others to let them join
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowFlyout(false)}
                      className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3.5">
                    {/* 1. Room Code */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Room Code / Name
                        </label>
                        <span className="text-[10px] text-slate-500">For "Join Room" modal</span>
                      </div>
                      <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-2xl p-2.5">
                        <span className="font-mono font-bold text-xs text-white flex-1 truncate select-all">
                          {podId}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-semibold text-white flex items-center gap-1 transition-colors cursor-pointer shadow-xs shrink-0"
                        >
                          {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                          <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    {/* 2. Room Secret Password */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Secret Password
                        </label>
                        <span className="text-[10px] text-indigo-400 font-medium">Stays private</span>
                      </div>
                      <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-2xl p-2.5">
                        <span className="font-mono font-medium text-xs text-white flex-1 truncate select-all">
                          {passphrase ? (showPassword ? passphrase : '••••••••••••••••••••') : 'No password set'}
                        </span>
                        {passphrase && (
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            title={showPassword ? 'Hide password' : 'Show password'}
                            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                          >
                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleCopyPass}
                          disabled={!passphrase}
                          className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-semibold text-white flex items-center gap-1 transition-colors cursor-pointer shadow-xs shrink-0 disabled:opacity-40"
                        >
                          {copiedPass ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                          <span>{copiedPass ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    {/* 3. 1-Tap Social Share & Copy Buttons */}
                    <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
                      {onOpenShare && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowFlyout(false);
                            sound.playClick();
                            onOpenShare();
                          }}
                          className="w-full py-2.5 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:opacity-95 text-white transition-all cursor-pointer tactile-btn shadow-md shadow-emerald-500/20"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>1-Tap Social Share (WhatsApp, Instagram)</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleCopyAll}
                        className={`w-full py-2 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer tactile-btn shadow-xs ${
                          copiedAll
                            ? 'bg-emerald-600 text-white'
                            : 'bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300'
                        }`}
                      >
                        {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedAll ? 'Room Code & Password Copied!' : 'Copy Code & Password (For Chat)'}</span>
                      </button>
                    </div>

                    {/* 4. Quick Auto-Join Link */}
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                      <span>Or copy direct invite link:</span>
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedLink ? 'Link Copied' : 'Copy Link'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center / Right Badges & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Friendly Security Badge */}
          <div className="hidden md:flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full font-medium shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>End-to-End Encrypted</span>
          </div>

          {/* Audio Synthesizer Toggle */}
          <button
            onClick={handleToggleSound}
            title={isMuted ? 'Turn Sound On' : 'Turn Sound Off'}
            className="p-1.5 sm:p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-indigo-400 transition-colors shadow-xs cursor-pointer shrink-0"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" />}
          </button>

          {/* Erase Room Button (if in a room) */}
          {onPurge && !isZeroized && (
            <button
              onClick={onPurge}
              title="Emergency Erase Room & Shred All Files"
              className="py-1 px-2.5 sm:py-1.5 sm:px-3.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 group cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="hidden sm:inline">Erase Room</span>
            </button>
          )}

          {/* Firebase Google Auth Session / Profile Pill */}
          <div className="shrink-0">
            <UserSessionPill />
          </div>
        </div>
      </div>
    </header>
  );
}
