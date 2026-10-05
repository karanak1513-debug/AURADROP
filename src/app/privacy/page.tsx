'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Navbar } from '@/components/layout/Navbar';
import { DynamicAuraCanvas as AuraCanvas } from '@/components/canvas/DynamicAuraCanvas';
import { ShieldCheck, Lock, Zap, ArrowLeft, FileText, CheckCircle2 } from 'lucide-react';

export default function PrivacyPolicyPage() {
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
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-3">
              <ShieldCheck className="w-4 h-4" />
              <span>Zero-Knowledge & Zero-Log Architecture</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-heading font-black text-white tracking-tight">
              Privacy Policy & Ephemeral Data Lifecycle
            </h1>
            <p className="text-xs text-slate-400 mt-2 font-mono">
              Effective Date: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-heading font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-400" />
              <span>1. Client-Side Cryptographic Isolation</span>
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed font-normal">
              AuraDrop is engineered under the principle of Zero-Knowledge. All file encryption, message decryption, and key derivations happen entirely within your local browser runtime via the Web Cryptography API (AES-256-GCM / PBKDF2).
            </p>
            <p className="text-sm text-slate-300 leading-relaxed font-normal">
              The decryption passphrase remains strictly behind the URL fragment identifier (<code className="text-indigo-400 font-mono">#key=...</code>). By design according to RFC 3986, fragment identifiers are never transmitted across HTTP requests to any server.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-heading font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              <span>2. Pure In-Memory Ephemeral Storage</span>
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed font-normal">
              AuraDrop maintains <strong className="text-white">zero database rows</strong>, zero persistent disk files, and zero server logging. Ephemeral data buffers reside strictly in volatile server RAM and are continuously scrubbed by our automated Janitor engine.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-300">
                <span className="font-bold text-white block mb-1">🔥 Single-Download Burn</span>
                When burn-on-download is enabled, encrypted file chunks are wiped and dereferenced the moment the recipient stream finishes.
              </div>
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-300">
                <span className="font-bold text-white block mb-1">⏰ Strict TTL Destruction</span>
                Memory pods and chat sockets automatically self-destruct upon expiration timer (15m to 24h) or when empty.
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-heading font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" />
              <span>3. Zero Personal Tracking or Third-Party Analytics</span>
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed font-normal">
              We do not track IP addresses, do not store access logs, do not utilize third-party tracking beacons, and do not sell data. Google OAuth is utilized strictly as an optional identity handshake on room entrance without storing user profiles in database tables.
            </p>
          </section>

          <div className="pt-6 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span>AuraDrop Security Team</span>
            <Link href="/terms" className="text-indigo-400 hover:text-indigo-300 font-bold">
              View Terms & Conditions →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
