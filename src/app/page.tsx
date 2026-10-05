'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Navbar } from '@/components/layout/Navbar';
import { LandingHub } from '@/components/landing/LandingHub';
import { DynamicAuraCanvas as AuraCanvas } from '@/components/canvas/DynamicAuraCanvas';
import { Lock, Zap, ShieldCheck, Radio, Shield, ExternalLink } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#07090E] text-slate-100 flex flex-col aura-ambient relative overflow-x-hidden selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* 3D WebGL Refractive Glass Geometric Canvas */}
      <AuraCanvas />

      {/* Interactive Floating Pill Navbar */}
      <Navbar />

      <main className="flex-1 relative z-10 w-full">
        <LandingHub />
      </main>

      {/* Luxury Dark Frosted Glass Footer */}
      <footer className="border-t border-white/10 bg-[#07090E]/85 backdrop-blur-2xl pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] px-4 sm:px-6 lg:px-8 text-xs text-slate-400 relative z-20 shadow-2xl">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group cursor-pointer">
              <div className="w-6 h-6 rounded-lg overflow-hidden p-[1px] bg-gradient-to-tr from-indigo-500 to-cyan-400">
                <Image
                  src="/logo.png"
                  alt="AuraDrop"
                  width={24}
                  height={24}
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
              <span className="font-heading font-black text-white text-sm tracking-tight group-hover:text-indigo-300 transition-colors">
                Aura<span className="text-indigo-400">Drop</span>
              </span>
            </Link>
            <span className="text-white/20">|</span>
            <span className="text-indigo-400 font-medium">Military-Grade Ephemeral Sharing</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Lock className="w-3.5 h-3.5 text-indigo-400" /> Client-Side AES-256-GCM
            </span>
            <span className="text-white/20 hidden sm:inline">•</span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <Zap className="w-3.5 h-3.5 text-cyan-400" /> RAM Auto-Shredding
            </span>
            <span className="text-white/20 hidden sm:inline">•</span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Zero Server Logs
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span>All systems live</span>
            </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/privacy"
              className="text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Privacy
            </Link>
            <span className="text-white/20">•</span>
            <Link
              href="/terms"
              className="text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Terms
            </Link>
            <span className="text-white/20">•</span>
            <Link
              href="/admin"
              className="text-xs font-semibold text-slate-300 hover:text-indigo-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Command Center</span>
              <span className="text-[9px] px-1.5 py-0.5 bg-white/10 rounded text-slate-300 font-mono">/admin</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  </div>
  );
}
