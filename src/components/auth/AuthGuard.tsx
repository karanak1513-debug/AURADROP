'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, Lock, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  featureName?: string;
  headline?: string;
  subtext?: string;
}

export function GoogleGIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export function AuthGuard({
  children,
  featureName,
  headline = 'Sign in with Google to continue',
  subtext = 'Authentication required to sync your ephemeral links and secure your encrypted chat stream.',
}: AuthGuardProps) {
  const { user, loading, signInWithGoogle, error, clearError } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  // If session is loading from Firebase, render an ultra-luxury frosted loading skeleton
  if (loading) {
    return (
      <div className="w-full min-h-[440px] flex flex-col items-center justify-center p-8">
        <div className="bg-white/80 backdrop-blur-2xl rounded-3xl border border-white/90 shadow-2xl p-10 max-w-md w-full flex flex-col items-center text-center relative overflow-hidden">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4 shadow-sm">
            <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
          </div>
          <h3 className="font-heading font-bold text-slate-900 text-sm mb-1">
            Verifying Session…
          </h3>
          <p className="text-xs text-slate-500 font-normal">
            Checking your Google authentication status securely.
          </p>
        </div>
      </div>
    );
  }

  // If authenticated, seamlessly reveal the full studio without reload
  if (user) {
    return <>{children}</>;
  }

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsSigningIn(false);
    }
  };

  // Ultra-luxury frosted glass gatekeeper card directly inside the feature canvas
  return (
    <div className="w-full min-h-[520px] flex items-center justify-center p-4 sm:p-8 relative">
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
        <div className="w-[500px] h-[500px] bg-gradient-to-tr from-indigo-200/40 via-purple-100/30 to-cyan-200/40 rounded-full blur-3xl opacity-70" />
      </div>

      <div className="relative z-10 w-full max-w-lg bg-white/80 backdrop-blur-2xl rounded-3xl border border-white/95 shadow-2xl p-8 sm:p-11 text-center transition-all duration-300 ring-1 ring-indigo-500/10 hover:shadow-[0_25px_60px_-15px_rgba(99,102,241,0.22)]">
        {/* Top Feature Tag */}
        {featureName && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50/90 border border-indigo-200/80 text-indigo-700 text-[11px] font-bold mb-6 shadow-xs">
            <Sparkles className="w-3 h-3 text-indigo-600" />
            <span>{featureName}</span>
          </div>
        )}

        {/* Gatekeeper Icon with Soft Indigo Halo */}
        <div className="relative mx-auto mb-6 w-20 h-20">
          <div className="absolute inset-0 rounded-3xl bg-indigo-500/15 blur-xl animate-pulse" />
          <div className="relative w-full h-full rounded-3xl bg-gradient-to-b from-white to-slate-50 border border-indigo-100 flex items-center justify-center shadow-lg shadow-indigo-500/10">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50/80 border border-indigo-200 flex items-center justify-center">
              <Lock className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        {/* Headline & Subtext */}
        <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 tracking-tight mb-3">
          {headline}
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal max-w-md mx-auto mb-7">
          {subtext}
        </p>

        {/* Error notification if popup was cancelled or failed */}
        {error && (
          <div className="mb-6 p-3 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs flex items-center justify-between gap-2 text-left animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
            <button
              onClick={clearError}
              className="text-xs font-bold text-rose-800 hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Action Button: "Continue with Google" with official Google 'G' SVG */}
        <button
          onClick={handleSignIn}
          disabled={isSigningIn}
          className="w-full py-3.5 px-6 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 text-slate-800 font-heading font-bold text-sm flex items-center justify-center gap-3 transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer group"
        >
          {isSigningIn ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
              <span>Connecting with Google…</span>
            </>
          ) : (
            <>
              <GoogleGIcon className="w-5 h-5 group-hover:scale-105 transition-transform" />
              <span>Continue with Google</span>
            </>
          )}
        </button>

        {/* Feature Security Trust Badges */}
        <div className="mt-7 pt-6 border-t border-slate-200/70 grid grid-cols-2 gap-3 text-left">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-bold text-slate-800">Verified Identity</p>
              <p className="text-[10px] text-slate-500">Google badge in live chat</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-bold text-slate-800">Cloud Link Sync</p>
              <p className="text-[10px] text-slate-500">Save & manage QR bundles</p>
            </div>
          </div>
        </div>

        {/* Note on Drop Vault being open */}
        <p className="mt-5 text-[11px] text-slate-400">
          The base <strong className="text-slate-600 font-semibold">Drop Vault</strong> remains 100% anonymous & zero-login.
        </p>
      </div>
    </div>
  );
}
