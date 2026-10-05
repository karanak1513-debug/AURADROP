'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  RefreshCw,
  Eye,
  EyeOff,
  ArrowRight,
  X,
  Lock,
  Shield,
  Zap,
  Clock,
  Users,
  Check,
  Copy,
} from 'lucide-react';
import {
  generateNATORoomId,
  generateSecurePassphrase,
  generateSalt,
} from '@/lib/crypto';
import { ChatRoomTTL } from '@/lib/chatStore';
import { sound } from '@/lib/sound';
import { createChatRoomRecord } from '@/lib/rooms';

interface CreateChatRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TTL_OPTIONS: { value: ChatRoomTTL; label: string; icon: string }[] = [
  { value: '15m', label: '15 minutes', icon: '⚡' },
  { value: '1h', label: '1 hour', icon: '🕐' },
  { value: '6h', label: '6 hours', icon: '🌙' },
  { value: '24h', label: '24 hours', icon: '📅' },
];

export function CreateChatRoomModal({ isOpen, onClose }: CreateChatRoomModalProps) {
  const router = useRouter();

  const [roomId, setRoomId] = useState(() => generateNATORoomId());
  const [passphrase, setPassphrase] = useState(() => generateSecurePassphrase());
  const [ttl, setTtl] = useState<ChatRoomTTL>('1h');
  const [burnOnEmpty, setBurnOnEmpty] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [stage, setStage] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);

  if (!isOpen) return null;

  const handleRegenId = () => {
    sound.playClick?.();
    setRoomId(generateNATORoomId());
  };

  const handleRegenPass = () => {
    sound.playKey?.();
    setPassphrase(generateSecurePassphrase());
  };

  const copyText = (text: string, which: 'id' | 'pass') => {
    navigator.clipboard.writeText(text).then(() => {
      if (which === 'id') { setCopiedId(true); setTimeout(() => setCopiedId(false), 2000); }
      else { setCopiedPass(true); setTimeout(() => setCopiedPass(false), 2000); }
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim() || !passphrase.trim()) return;

    try {
      setIsCreating(true);
      sound.playClick?.();
      setStage('Generating encryption keys…');

      const normId = roomId.trim().toUpperCase();
      const salt = generateSalt();
      const peerId = `host-${Date.now().toString(36)}`;
      const ttlHours = ttl === '24h' ? 24 : ttl === '6h' ? 6 : ttl === '15m' ? 0.25 : 1;

      // Authoritative Firestore handshake commit
      await createChatRoomRecord(
        normId,
        salt,
        ttlHours,
        'anonymous',
        { salt, hostPeerId: peerId }
      );

      await new Promise(r => setTimeout(r, 100));
      setStage('Provisioning encrypted room…');

      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: normId,
          salt,
          ttl,
          hostPeerId: peerId,
          burnOnEmpty,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create chat room');
      }

      setStage('Opening your private chat room…');
      sound.playSuccess?.();
      await new Promise(r => setTimeout(r, 200));

      // Navigate — passphrase only in hash fragment (never in query params)
      router.push(
        `/chat/${encodeURIComponent(normId)}#key=${encodeURIComponent(passphrase.trim())}`
      );
      onClose();
    } catch (err) {
      console.error('[CreateChatRoomModal] Error:', err);
      setIsCreating(false);
      setStage('');
      sound.playAlert?.();
      alert(err instanceof Error ? err.message : 'Could not create chat room. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
      <div className="relative w-full max-w-lg bg-white/98 backdrop-blur-xl border border-slate-200/90 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header gradient bar */}
        <div className="h-1 bg-gradient-to-r from-indigo-600 via-purple-500 to-cyan-500" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 sm:p-7">
          {/* Title */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-600 flex items-center justify-center text-xl shadow-md shadow-indigo-500/20">
              💬
            </div>
            <div>
              <h2 className="font-heading font-bold text-base text-slate-900 tracking-tight">
                Start AURA CHAT Room
              </h2>
              <p className="text-[11px] text-slate-400 font-normal">
                E2EE · Ephemeral · Zero logs · Self-destructing
              </p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            {/* Room ID */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                Room ID
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 outline-none transition-all"
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={() => copyText(roomId, 'id')}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                  title="Copy room ID"
                >
                  {copiedId ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleRegenId}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                  title="Regenerate ID"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Passphrase */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                Secret Password
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showPassphrase ? 'text' : 'password'}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl px-3.5 py-2.5 text-xs font-mono text-slate-900 outline-none transition-all pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassphrase(!showPassphrase)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassphrase ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(passphrase, 'pass')}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                  title="Copy password"
                >
                  {copiedPass ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleRegenPass}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                  title="Regenerate password"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 font-normal">
                Share this password with people you want to invite. It never leaves your device.
              </p>
            </div>

            {/* TTL */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-2 uppercase tracking-wider">
                Auto-Destruct Timer
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {TTL_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { sound.playClick?.(); setTtl(opt.value); }}
                    className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-2xl border text-[11px] font-bold transition-all cursor-pointer ${
                      ttl === opt.value
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/25'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                    }`}
                  >
                    <span className="text-base">{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Burn on empty toggle */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Burn When Empty</p>
                  <p className="text-[10px] text-slate-400 font-normal">Destroy room when last member leaves</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBurnOnEmpty(!burnOnEmpty)}
                className={`relative w-10 h-5.5 rounded-full transition-colors cursor-pointer shrink-0 ${burnOnEmpty ? 'bg-rose-500' : 'bg-slate-300'}`}
                style={{ height: '22px' }}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${burnOnEmpty ? 'translate-x-5' : 'translate-x-0.5'}`}
                />
              </button>
            </div>

            {/* Security badges */}
            <div className="flex flex-wrap gap-2">
              {[
                { icon: Lock, text: 'AES-256-GCM', color: 'indigo' },
                { icon: Shield, text: 'Zero Knowledge', color: 'emerald' },
                { icon: Users, text: 'No Accounts', color: 'cyan' },
                { icon: Clock, text: 'Auto-Destructs', color: 'amber' },
              ].map(({ icon: Icon, text, color }) => (
                <span
                  key={text}
                  className={`flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border bg-${color}-50 border-${color}-200 text-${color}-700`}
                >
                  <Icon className="w-3 h-3" />
                  {text}
                </span>
              ))}
            </div>

            {/* Loading stage indicator */}
            {isCreating && stage && (
              <div className="flex items-center gap-2.5 p-3 bg-indigo-50 rounded-2xl border border-indigo-200">
                <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin shrink-0" />
                <p className="text-xs text-indigo-700 font-medium">{stage}</p>
              </div>
            )}

            {/* Create button */}
            <button
              type="submit"
              disabled={isCreating || !roomId.trim() || !passphrase.trim()}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:opacity-95 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {isCreating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4" />
                  Launch Chat Room
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
