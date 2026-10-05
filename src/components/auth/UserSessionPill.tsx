'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { GoogleGIcon } from '@/components/auth/AuthGuard';
import { LogOut, ChevronDown, CheckCircle, RefreshCw, User as UserIcon } from 'lucide-react';
import { sound } from '@/lib/sound';

export function UserSessionPill() {
  const { user, loading, signInWithGoogle, signOutUser } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleSignIn = async () => {
    sound.playClick?.();
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    sound.playClick?.();
    setShowDropdown(false);
    await signOutUser();
  };

  if (loading) {
    return (
      <button
        type="button"
        disabled
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-white/5 text-slate-400 border border-white/10 text-xs font-semibold shadow-xs opacity-80 shrink-0"
      >
        <GoogleGIcon className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">Sign in with Google</span>
        <span className="sm:hidden text-[11px]">Sign in</span>
      </button>
    );
  }

  // Not logged in: Show sleek [ Sign in with Google ] pill button
  if (!user) {
    return (
      <button
        type="button"
        onClick={handleSignIn}
        disabled={isSigningIn}
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 hover:border-indigo-500/40 text-xs font-semibold shadow-xs transition-all duration-200 cursor-pointer tactile-btn group shrink-0"
        title="Sign in with Google to unlock Live Chat and Smart Linktree"
      >
        {isSigningIn ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
        ) : (
          <GoogleGIcon className="w-3.5 h-3.5 group-hover:scale-105 transition-transform shrink-0" />
        )}
        <span className="hidden sm:inline">Sign in with Google</span>
        <span className="sm:hidden text-[11px]">Sign in</span>
      </button>
    );
  }

  // Logged in: Show Google display avatar, name snippet, and discrete dropdown pill
  const nameSnippet =
    user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'User';

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          sound.playClick?.();
          setShowDropdown(!showDropdown);
        }}
        className={`flex items-center gap-1.5 sm:gap-2 pl-1 pr-2 sm:pr-2.5 py-1 rounded-full border transition-all duration-200 cursor-pointer shadow-xs ${
          showDropdown
            ? 'bg-indigo-600/20 border-indigo-500 text-white ring-2 ring-indigo-400/20'
            : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
        }`}
        title={`${user.displayName || 'Google Account'} (${user.email})`}
      >
        {/* Google Display Avatar */}
        <div className="relative w-6 h-6 rounded-full overflow-hidden border border-indigo-400/40 shrink-0 bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-white text-[10px] font-bold">
          {user.photoURL && !avatarError ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'Avatar'}
              className="w-full h-full object-cover"
              onError={() => setAvatarError(true)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <span>{nameSnippet.charAt(0).toUpperCase()}</span>
          )}
        </div>

        {/* Name snippet */}
        <span className="text-xs font-bold truncate max-w-[70px] sm:max-w-[120px]">
          {nameSnippet}
        </span>

        {/* Small verified badge */}
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />

        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
            showDropdown ? 'rotate-180 text-indigo-400' : ''
          }`}
        />
      </button>

      {/* Discrete Dropdown Pill */}
      {showDropdown && (
        <div className="fixed inset-x-3 top-16 sm:absolute sm:top-full sm:right-0 sm:left-auto sm:inset-x-auto sm:w-64 apple-frosted-glass rounded-2xl p-3.5 shadow-2xl border border-white/10 bg-[#0D1222]/98 backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-3 pb-3 mb-2.5 border-b border-white/10">
            <div className="relative w-10 h-10 rounded-full overflow-hidden border border-indigo-400/30 shrink-0 bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-white text-sm font-bold shadow-xs">
              {user.photoURL && !avatarError ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Avatar'}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{nameSnippet.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className="font-heading font-bold text-xs text-white truncate">
                  {user.displayName || 'Google User'}
                </p>
                <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
              </div>
              <p className="text-[11px] text-slate-400 truncate font-normal">
                {user.email}
              </p>
            </div>
          </div>

          <div className="px-2.5 py-1.5 mb-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-[11px] text-slate-300">
            <span className="font-medium">Account Status</span>
            <span className="font-bold text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Google Verified
            </span>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="w-full py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
