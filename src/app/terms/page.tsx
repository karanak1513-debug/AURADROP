'use client';

import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { DynamicAuraCanvas as AuraCanvas } from '@/components/canvas/DynamicAuraCanvas';
import { ShieldAlert, ArrowLeft, CheckCircle2, AlertTriangle, Scale } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col aura-ambient relative overflow-x-hidden">
      <AuraCanvas />
      <Navbar />

      <main className="flex-1 relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-12 w-full">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors mb-8 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to AuraDrop</span>
        </Link>

        <div className="apple-frosted-glass rounded-3xl p-6 sm:p-10 shadow-2xl border border-white/10 space-y-8">
          <div className="border-b border-white/10 pb-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold mb-3">
              <Scale className="w-4 h-4" />
              <span>Service Legal Agreement</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-heading font-black text-white tracking-tight">
              Terms & Conditions of Service
            </h1>
            <p className="text-xs text-slate-400 mt-2 font-mono">
              Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-heading font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <span>1. Ephemeral Nature & Irreversible Destruction Disclaimer</span>
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed font-normal">
              AuraDrop is an ephemeral, self-destructing data transmission service. By utilizing the platform, you acknowledge and agree that files and chat transcripts that undergo expiration, burn-on-download, or manual zeroization are <strong className="text-white">permanently, irreversibly unrecoverable</strong>. AuraDrop maintains no archives, backups, or shadow copies.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-heading font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              <span>2. Acceptable Use Policy</span>
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed font-normal">
              You agree not to transmit, host, or disseminate malicious software, exploitative material, unauthorized surveillance captures, or content that violates applicable international laws. AuraDrop reserves the automated capability to zeroize memory pods flagged by cryptographic entropy safeguards.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-heading font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>3. Limitation of Liability</span>
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed font-normal">
              The service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind. Under no circumstances shall AuraDrop or its contributors be liable for any lost data, incomplete transfers, or expired tokens resulting from user-configured TTL timers or browser terminations.
            </p>
          </section>

          <div className="pt-6 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span>AuraDrop Legal Counsel</span>
            <Link href="/privacy" className="text-indigo-400 hover:text-indigo-300 font-bold">
              View Privacy Policy →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
