'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Shield,
  ShieldAlert,
  Server,
  HardDrive,
  MessageSquare,
  QrCode,
  Flame,
  Zap,
  RefreshCw,
  Trash2,
  Users,
  Clock,
  ArrowUpRight,
  Activity,
  CheckCircle2,
  Lock,
  FileText,
  Sliders,
  Cpu,
  Layers,
  Radio,
  Eye,
  X,
  ExternalLink,
  ChevronDown,
  Sparkles,
  Volume2,
  Bell,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { Navbar } from '@/components/layout/Navbar';
import { DynamicAuraCanvas as AuraCanvas } from '@/components/canvas/DynamicAuraCanvas';
import { useAuth } from '@/context/AuthContext';
import { GoogleGIcon } from '@/components/auth/AuthGuard';
import { sound } from '@/lib/sound';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { db } from '@/lib/firestore';

interface AdminTelemetryData {
  success: boolean;
  timestamp: number;
  summary: {
    activePods: number;
    activeChatRooms: number;
    totalActiveEntities: number;
    totalFiles: number;
    totalEncryptedBytes: number;
    totalEncryptedMB: string;
    totalMessages: number;
    totalBurnedMessages: number;
    totalConnections: number;
    activeSubscribers: number;
  };
  system: {
    memoryUsage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    janitorRunning: boolean;
    uptimeSeconds: number;
    nodeVersion: string;
  };
  pods: Array<{
    id: string;
    createdAt: number;
    expiresAt: number;
    ttlSeconds: number;
    burnOnDownload: boolean;
    burnOnEmpty: boolean;
    isZeroized: boolean;
    fileCount: number;
    peerCount: number;
    totalFileBytes: number;
    auditLogLength: number;
    recentAudit: Array<{
      id: string;
      timestamp: number;
      type: string;
      message: string;
    }>;
  }>;
  chatRooms: Array<{
    id: string;
    createdAt: number;
    expiresAt: number;
    ttlSeconds: number;
    hostPeerId: string;
    memberCount: number;
    messageCount: number;
    burnedCount: number;
    burnOnEmpty: boolean;
    isDestroyed: boolean;
    members: Array<{
      id: string;
      codename: string;
      displayName?: string;
      email?: string;
      isHost: boolean;
      lastPing: number;
    }>;
  }>;
  analytics: {
    hourly: Array<{
      time: string;
      activeSessions: number;
      filesDropped: number;
      messagesRelayed: number;
      bytesEncryptedKB: number;
      burnDestructions: number;
    }>;
    featureDistribution: Array<{
      name: string;
      value: number;
      color: string;
    }>;
    destructionStats: Array<{
      category: string;
      count: number;
      fill: string;
    }>;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export default function AdminCommandCenterPage() {
  const { user: authUser, loading: authLoading, signInWithGoogle, signOutUser } = useAuth();

  const [telemetry, setTelemetry] = useState<AdminTelemetryData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'pods' | 'chat' | 'security' | 'system' | 'broadcast'>('overview');
  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const [nukingId, setNukingId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [firestoreAuditEvents, setFirestoreAuditEvents] = useState<any[]>([]);

  // ── Live Broadcast & Announcement System ──
  const [broadcastTitle, setBroadcastTitle] = useState<string>('');
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [broadcastType, setBroadcastType] = useState<'info' | 'warning' | 'alert' | 'success' | 'emergency'>('alert');
  const [broadcastPriority, setBroadcastPriority] = useState<'low' | 'normal' | 'urgent'>('urgent');
  const [broadcastDuration, setBroadcastDuration] = useState<number>(15);
  const [broadcastSound, setBroadcastSound] = useState<boolean>(true);
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);
  const [broadcastNotice, setBroadcastNotice] = useState<string>('');
  const [activeAnnouncements, setActiveAnnouncements] = useState<any[]>([]);
  const [liveSubscribers, setLiveSubscribers] = useState<number>(0);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch Telemetry from Admin Metrics API
  const fetchTelemetry = useCallback(async (showIndicator = false) => {
    try {
      if (showIndicator) setIsRefreshing(true);
      const res = await fetch('/api/admin/metrics', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
    } catch (err) {
      console.warn('[Admin] Metrics fetch error:', err);
    } finally {
      setIsLoading(false);
      if (showIndicator) setIsRefreshing(false);
    }
  }, []);

  // Setup Firestore realtime listener for live security telemetry
  useEffect(() => {
    if (!authUser) return;
    try {
      const q = query(collection(db, 'system_metrics'), limit(15));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const events: any[] = [];
        snapshot.forEach((doc) => {
          events.push({ id: doc.id, ...doc.data() });
        });
        setFirestoreAuditEvents(events);
      }, (err) => {
        // Graceful fallback if security rules deny or in dev
        console.warn('[Admin Firestore Realtime] Fallback active:', err.message);
      });
      return () => unsubscribe();
    } catch (err) {
      console.warn('[Admin Firestore init]', err);
    }
  }, [authUser]);

  // Fetch active announcements & subscriber count
  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch('/api/announcements');
      if (res.ok) {
        const data = await res.json();
        setActiveAnnouncements(data.announcements || []);
        setLiveSubscribers(data.activeSubscribers || 0);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Broadcast a new live announcement
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim() || isBroadcasting) return;

    try {
      setIsBroadcasting(true);
      setBroadcastNotice('');
      sound.playClick?.();

      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: broadcastTitle.trim(),
          message: broadcastMessage.trim(),
          type: broadcastType,
          priority: broadcastPriority,
          expiresInMinutes: broadcastDuration,
          soundAlert: broadcastSound,
          broadcastBy: 'AURA COMMAND HQ',
        }),
      });

      if (res.ok) {
        sound.playSuccess?.();
        setBroadcastNotice('✓ Broadcast dispatched live to all users across the website!');
        setBroadcastTitle('');
        setBroadcastMessage('');
        await fetchAnnouncements();
      } else {
        sound.playAlert?.();
        setBroadcastNotice('Failed to dispatch broadcast.');
      }
    } catch {
      sound.playAlert?.();
      setBroadcastNotice('Network error broadcasting announcement.');
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Revoke a single announcement
  const handleRevokeAnnouncement = async (id: string) => {
    try {
      sound.playBurn?.();
      const res = await fetch(`/api/announcements?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        sound.playSuccess?.();
        await fetchAnnouncements();
      }
    } catch {
      // Ignore
    }
  };

  // Clear all active announcements
  const handleClearAllAnnouncements = async () => {
    if (!confirm('EMERGENCY: Clear and revoke ALL live announcements from user screens immediately?')) return;
    try {
      sound.playBurn?.();
      const res = await fetch('/api/announcements?all=true', { method: 'DELETE' });
      if (res.ok) {
        sound.playSuccess?.();
        await fetchAnnouncements();
      }
    } catch {
      // Ignore
    }
  };

  // Polling loop for in-memory volatile engine and live announcements
  useEffect(() => {
    fetchTelemetry();
    fetchAnnouncements();
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchTelemetry(false);
      fetchAnnouncements();
    }, 3500);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchTelemetry, fetchAnnouncements]);

  // Admin Actions
  const handleNukePod = async (podId: string) => {
    if (!confirm(`EMERGENCY ZEROIZE: Permanently destroy Pod [${podId}] and shred all file buffers from RAM immediately?`)) {
      return;
    }
    try {
      setNukingId(podId);
      sound.playBurn?.();
      const res = await fetch('/api/admin/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'nuke_pod', targetId: podId }),
      });
      if (res.ok) {
        sound.playSuccess?.();
        setSelectedEntity(null);
        await fetchTelemetry(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setNukingId(null);
    }
  };

  const handleNukeRoom = async (roomId: string) => {
    if (!confirm(`EMERGENCY ZEROIZE: Permanently destroy Chatroom [${roomId}] and purge all messages from RAM immediately?`)) {
      return;
    }
    try {
      setNukingId(roomId);
      sound.playBurn?.();
      const res = await fetch('/api/admin/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'nuke_room', targetId: roomId }),
      });
      if (res.ok) {
        sound.playSuccess?.();
        setSelectedEntity(null);
        await fetchTelemetry(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setNukingId(null);
    }
  };

  const handleForceJanitor = async () => {
    try {
      setIsRefreshing(true);
      sound.playClick?.();
      const res = await fetch('/api/admin/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'force_janitor' }),
      });
      if (res.ok) {
        sound.playSuccess?.();
        await fetchTelemetry(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filtered Pods & Rooms
  const filteredPods = useMemo(() => {
    if (!telemetry?.pods) return [];
    if (!searchFilter.trim()) return telemetry.pods;
    return telemetry.pods.filter((p) => p.id.toLowerCase().includes(searchFilter.toLowerCase()));
  }, [telemetry?.pods, searchFilter]);

  const filteredChatRooms = useMemo(() => {
    if (!telemetry?.chatRooms) return [];
    if (!searchFilter.trim()) return telemetry.chatRooms;
    return telemetry.chatRooms.filter((r) => r.id.toLowerCase().includes(searchFilter.toLowerCase()));
  }, [telemetry?.chatRooms, searchFilter]);

  // ── Render Gatekeeper if Not Authenticated ────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0B0F19] text-white flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-xs font-semibold text-slate-400">Verifying Admin Credentials…</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-[#0B0F19] text-white flex flex-col justify-between p-6 relative overflow-hidden">
        <AuraCanvas />
        <Navbar />

        <div className="max-w-md w-full mx-auto my-auto relative z-10">
          <div className="bg-[#111827]/90 backdrop-blur-2xl border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-2xl mx-auto mb-5 shadow-lg shadow-indigo-500/10">
              <Shield className="w-8 h-8" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold mb-3">
              <Lock className="w-3.5 h-3.5" />
              <span>AURA OPS COMMAND CENTER</span>
            </div>

            <h1 className="font-heading font-black text-2xl text-white tracking-tight mb-2">
              Admin Authentication Required
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed mb-6 font-normal">
              Sign in with your verified Google account to access real-time memory telemetry, live active room audits, and emergency destruction controls.
            </p>

            <button
              onClick={() => signInWithGoogle()}
              className="w-full py-3.5 px-5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all cursor-pointer"
            >
              <GoogleGIcon className="w-4 h-4 shrink-0" />
              <span>Sign in with Google as Admin</span>
            </button>

            <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-500">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>Memory Engine Guard: Zero Cloud DB Leaks</span>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-slate-600 relative z-10">
          AURA DROP SECURITY & OPERATIONS PROTOCOL
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col relative overflow-hidden font-sans">
      {/* 3D Atmospheric Background */}
      <AuraCanvas />

      {/* ── Top Executive Command Bar ── */}
      <header className="sticky top-0 z-50 bg-[#0B0F19]/80 backdrop-blur-xl border-b border-slate-800/90 px-4 sm:px-6 lg:px-8 py-3 transition-all">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Brand & Live Pulse */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 p-[1.5px] shadow-sm">
                <div className="w-full h-full bg-[#0B0F19] rounded-xl flex items-center justify-center text-indigo-400">
                  <Shield className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-heading font-black text-base text-white tracking-tight">
                    AURA <span className="text-indigo-400">COMMAND</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    v2.4 OPS
                  </span>
                </div>
              </div>
            </Link>

            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-800 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-mono text-[11px]">
                <Radio className="w-3 h-3 animate-pulse" />
                STREAM ACTIVE
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400 font-mono text-[11px]">
                UPTIME: {telemetry ? formatUptime(telemetry.system.uptimeSeconds) : '…'}
              </span>
            </div>
          </div>

          {/* Quick Controls & Admin Profile Pill */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleForceJanitor}
              title="Force background janitor sweep to shred expired pods immediately"
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">Force Janitor Sweep</span>
            </button>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                autoRefresh
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Live Auto-Poll {autoRefresh ? 'ON' : 'OFF'}</span>
            </button>

            {/* Admin Session Dropdown */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full">
              {authUser.photoURL ? (
                <img src={authUser.photoURL} alt="Admin" className="w-5 h-5 rounded-full" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] flex items-center justify-center font-bold">
                  A
                </div>
              )}
              <span className="text-xs font-bold text-slate-200 hidden md:inline truncate max-w-[120px]">
                {authUser.displayName || authUser.email}
              </span>
              <button
                onClick={() => signOutUser()}
                className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors ml-1 font-semibold cursor-pointer"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Operations Canvas ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10 space-y-6">
        {/* ── 1. Executive Telemetry HUD (4 Metric Cards) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Active Disposable Pods & Rooms */}
          <div className="bg-[#111827]/80 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Active Entities
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-heading font-black text-2xl text-white">
                {telemetry?.summary.totalActiveEntities ?? 0}
              </span>
              <span className="text-xs text-indigo-400 font-semibold font-mono">
                {telemetry?.summary.activePods ?? 0} pods · {telemetry?.summary.activeChatRooms ?? 0} chats
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">100% Volatile RAM Store</p>
          </div>

          {/* Card 2: Encrypted Memory Footprint */}
          <div className="bg-[#111827]/80 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                RAM Buffer Volume
              </span>
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                <HardDrive className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-heading font-black text-2xl text-white">
                {telemetry ? formatBytes(telemetry.summary.totalEncryptedBytes) : '0 B'}
              </span>
              <span className="text-xs text-cyan-400 font-semibold font-mono">
                {telemetry?.summary.totalFiles ?? 0} files
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">AES-256-GCM In-Memory</p>
          </div>

          {/* Card 3: Ephemeral Chat Stream & Auto-Burns */}
          <div className="bg-[#111827]/80 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Relayed Messages
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-heading font-black text-2xl text-white">
                {telemetry?.summary.totalMessages ?? 0}
              </span>
              <span className="text-xs text-rose-400 font-semibold flex items-center gap-1">
                <Flame className="w-3 h-3" />
                {telemetry?.summary.totalBurnedMessages ?? 0} burned
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Double Blue Tick Verified</p>
          </div>

          {/* Card 4: Connections & System Zeroizes */}
          <div className="bg-[#111827]/80 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Online Subscribers
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-heading font-black text-2xl text-white">
                {telemetry?.summary.totalConnections ?? 0}
              </span>
              <span className="text-xs text-emerald-400 font-semibold font-mono">
                SSE Active
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Real-time mesh delivery</p>
          </div>
        </div>

        {/* ── 2. Live Visual Analytics with Recharts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Chart: Real-time Hourly Transfer Stream (8 cols) */}
          <div className="lg:col-span-8 bg-[#111827]/80 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading font-bold text-base text-white tracking-tight">
                  Throughput & Transfer Activity (Last 12 Hours)
                </h3>
                <p className="text-xs text-slate-400">
                  Real-time encrypted payload streaming & session spikes
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-xl">
                LIVE TICKS
              </span>
            </div>

            <div className="h-64 w-full">
              {isMounted && telemetry?.analytics.hourly ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={telemetry.analytics.hourly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                    <XAxis dataKey="time" stroke="#6B7280" fontSize={11} tickLine={false} />
                    <YAxis stroke="#6B7280" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#111827',
                        border: '1px solid #374151',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: '#F9FAFB',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Area
                      type="monotone"
                      dataKey="activeSessions"
                      name="Active Sessions"
                      stroke="#6366F1"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorSessions)"
                    />
                    <Area
                      type="monotone"
                      dataKey="messagesRelayed"
                      name="Messages Relayed"
                      stroke="#06B6D4"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorMessages)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2 text-indigo-400" />
                  Generating analytics stream…
                </div>
              )}
            </div>
          </div>

          {/* Secondary Chart: Feature Split & Self-Destruct Breakdown (4 cols) */}
          <div className="lg:col-span-4 bg-[#111827]/80 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-bold text-base text-white tracking-tight">
                  Feature Share
                </h3>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                  DISTRIBUTION
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Usage breakdown across the 3 isolated modules
              </p>

              <div className="h-44 w-full">
                {isMounted && telemetry?.analytics.featureDistribution ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={telemetry.analytics.featureDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {telemetry.analytics.featureDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111827',
                          border: '1px solid #374151',
                          borderRadius: '10px',
                          fontSize: '11px',
                          color: '#F9FAFB',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : null}
              </div>

              {/* Legend List */}
              <div className="space-y-1.5 pt-2">
                {telemetry?.analytics.featureDistribution.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-300 font-medium">{item.name}</span>
                    </div>
                    <span className="font-bold text-white font-mono">{item.value} active</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. Operations Section (Navigation Tabs) ── */}
        <div className="bg-[#111827]/80 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-5 sm:p-6 shadow-sm">
          {/* Navigation Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-2xl border border-slate-800">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Entities ({telemetry?.summary.totalActiveEntities ?? 0})
              </button>
              <button
                onClick={() => setActiveTab('pods')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'pods' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                File Drop Pods ({telemetry?.summary.activePods ?? 0})
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'chat' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Chatrooms ({telemetry?.summary.activeChatRooms ?? 0})
              </button>
              <button
                onClick={() => setActiveTab('system')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'system' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Engine & Diagnostics
              </button>
              <button
                onClick={() => setActiveTab('broadcast')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'broadcast' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                <span>Live Broadcast</span>
                {activeAnnouncements.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-mono">
                    {activeAnnouncements.length}
                  </span>
                )}
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search Room / Pod ID…"
                className="bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-1.5 text-xs text-white outline-none w-56 placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* ── Tab Content: Active Pods & Rooms Table ── */}
          <div className="pt-4 overflow-x-auto">
            {activeTab === 'broadcast' ? (
              <div className="space-y-6">
                {/* Broadcast Composer */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-rose-500/50 to-transparent" />
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                        <h3 className="font-heading font-bold text-white text-base tracking-tight">
                          Live Global Announcement Dispatcher
                        </h3>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Instantly pushes real-time announcements to every user browsing any page of the website via SSE.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        {liveSubscribers} Client{liveSubscribers === 1 ? '' : 's'} Online
                      </span>
                    </div>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="mb-4">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Quick Templates
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBroadcastTitle('⚡ Scheduled Maintenance in 15 Minutes');
                          setBroadcastMessage('System will undergo cryptographic memory zeroization. Please save your work.');
                          setBroadcastType('warning');
                          setBroadcastPriority('urgent');
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition-all"
                      >
                        ⚠️ Maintenance in 15m
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBroadcastTitle('🛡️ Zero-Trace Security Notice');
                          setBroadcastMessage('All files and chats in this session are protected with client-side end-to-end encryption.');
                          setBroadcastType('info');
                          setBroadcastPriority('normal');
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition-all"
                      >
                        🛡️ Security Advisory
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBroadcastTitle('🔴 EMERGENCY ZEROIZE ACTIVE');
                          setBroadcastMessage('All ephemeral pods and chat sessions are being wiped from memory immediately.');
                          setBroadcastType('emergency');
                          setBroadcastPriority('urgent');
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 cursor-pointer transition-all"
                      >
                        🔴 Emergency Shred Alert
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBroadcastTitle('✨ AuraDrop v2.5 Live Now');
                          setBroadcastMessage('Real-time P2P WebRTC data channels and military-grade encryption are now active!');
                          setBroadcastType('success');
                          setBroadcastPriority('normal');
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 cursor-pointer transition-all"
                      >
                        ✨ New Feature Release
                      </button>
                    </div>
                  </div>

                  {/* Broadcast Form */}
                  <form onSubmit={handleSendBroadcast} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1">
                          Announcement Title
                        </label>
                        <input
                          type="text"
                          value={broadcastTitle}
                          onChange={(e) => setBroadcastTitle(e.target.value)}
                          placeholder="e.g. ⚡ System Update Incoming…"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs font-bold text-slate-300 block mb-1">
                            Type
                          </label>
                          <select
                            value={broadcastType}
                            onChange={(e) => setBroadcastType(e.target.value as any)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-2 py-2.5 text-xs text-white outline-none"
                          >
                            <option value="alert">Alert (Red)</option>
                            <option value="warning">Warning (Amber)</option>
                            <option value="info">Info (Indigo)</option>
                            <option value="success">Success (Green)</option>
                            <option value="emergency">Emergency (Dark Red)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-300 block mb-1">
                            Priority
                          </label>
                          <select
                            value={broadcastPriority}
                            onChange={(e) => setBroadcastPriority(e.target.value as any)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-2 py-2.5 text-xs text-white outline-none"
                          >
                            <option value="urgent">Urgent</option>
                            <option value="normal">Normal</option>
                            <option value="low">Low</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-300 block mb-1">
                            Duration
                          </label>
                          <select
                            value={broadcastDuration}
                            onChange={(e) => setBroadcastDuration(Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-2 py-2.5 text-xs text-white outline-none"
                          >
                            <option value={5}>5 mins</option>
                            <option value={15}>15 mins</option>
                            <option value={60}>1 hour</option>
                            <option value={1440}>24 hours</option>
                            <option value={0}>Permanent</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        Announcement Message
                      </label>
                      <textarea
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        placeholder="Detailed announcement text to show on all user screens…"
                        rows={3}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none resize-none"
                        required
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={broadcastSound}
                          onChange={(e) => setBroadcastSound(e.target.checked)}
                          className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-800 focus:ring-0 cursor-pointer"
                        />
                        <Volume2 className="w-4 h-4 text-indigo-400" />
                        <span>Play audio ping chime on user screens</span>
                      </label>

                      <button
                        type="submit"
                        disabled={isBroadcasting || !broadcastTitle.trim() || !broadcastMessage.trim()}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-indigo-600 to-cyan-500 hover:from-rose-500 hover:via-indigo-500 hover:to-cyan-400 text-white font-heading font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Radio className="w-4 h-4 animate-pulse" />
                        <span>{isBroadcasting ? 'Broadcasting…' : 'Broadcast Live Now'}</span>
                      </button>
                    </div>

                    {broadcastNotice && (
                      <p className="text-xs font-semibold text-emerald-400 pt-2">{broadcastNotice}</p>
                    )}
                  </form>
                </div>

                {/* Active Announcements List */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-indigo-400" />
                      <h4 className="font-heading font-bold text-white text-sm">
                        Active Live Announcements ({activeAnnouncements.length})
                      </h4>
                    </div>
                    {activeAnnouncements.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllAnnouncements}
                        className="px-3 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Revoke All</span>
                      </button>
                    )}
                  </div>

                  {activeAnnouncements.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 text-xs font-sans">
                      No active announcements currently broadcasting. Broadcast one above to send real-time alerts to all users.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeAnnouncements.map((ann) => (
                        <div
                          key={ann.id}
                          className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                {ann.type}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                {ann.priority}
                              </span>
                              <h5 className="font-heading font-bold text-white text-xs truncate">
                                {ann.title}
                              </h5>
                              <span className="text-[10px] text-slate-500 font-mono ml-auto">
                                {new Date(ann.createdAt).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed break-words font-normal">
                              {ann.message}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRevokeAnnouncement(ann.id)}
                            className="self-end sm:self-center shrink-0 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                            title="Revoke and remove from all screens"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            <span>Revoke</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'system' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-300">
                    <Cpu className="w-4 h-4 text-indigo-400" />
                    <span>Node V8 Memory Usage</span>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>RSS:</span>
                      <span className="text-white font-bold">
                        {telemetry ? formatBytes(telemetry.system.memoryUsage.rss) : '…'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Heap Used:</span>
                      <span className="text-white font-bold">
                        {telemetry ? formatBytes(telemetry.system.memoryUsage.heapUsed) : '…'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Heap Total:</span>
                      <span className="text-white font-bold">
                        {telemetry ? formatBytes(telemetry.system.memoryUsage.heapTotal) : '…'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-300">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span>Janitor & DoD Shredding</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    Automated janitor sweeps every 10 seconds. Memory buffers are zeroized prior to dereferencing.
                  </p>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                    ✓ ACTIVE JANITOR ENGINE
                  </span>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-300">
                    <Lock className="w-4 h-4 text-purple-400" />
                    <span>Zero Permanent Cloud Storage</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    All file and chat payloads are isolated to ephemeral RAM. Zero rows written to persistent SQL/NoSQL databases.
                  </p>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/10 border border-purple-500/20 text-purple-300">
                    ✓ ZERO-KNOWLEDGE PROOF
                  </span>
                </div>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="pb-3 pl-2">Entity ID</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Payload Details</th>
                    <th className="pb-3">Online Peers</th>
                    <th className="pb-3">Remaining TTL</th>
                    <th className="pb-3 text-right pr-2">Emergency Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {/* File Drop Pods */}
                  {(activeTab === 'overview' || activeTab === 'pods') &&
                    filteredPods.map((p) => {
                      const secondsLeft = Math.max(0, Math.floor((p.expiresAt - Date.now()) / 1000));
                      return (
                        <tr key={p.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 pl-2 font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-400" />
                            <span>{p.id}</span>
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              FILE DROP
                            </span>
                          </td>
                          <td className="py-3 text-slate-300 font-sans">
                            {p.fileCount} file(s) · {formatBytes(p.totalFileBytes)}
                            {p.burnOnDownload && (
                              <span className="ml-2 text-[10px] text-rose-400 font-semibold">
                                🔥 Burn-on-Download
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-slate-300">{p.peerCount} peer(s)</td>
                          <td className="py-3 text-amber-400 font-bold font-mono">
                            {Math.floor(secondsLeft / 60)}m {secondsLeft % 60}s
                          </td>
                          <td className="py-3 text-right pr-2">
                            <button
                              onClick={() => handleNukePod(p.id)}
                              disabled={nukingId === p.id}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[11px] font-sans font-bold flex items-center gap-1 ml-auto cursor-pointer transition-all"
                            >
                              <Trash2 className="w-3 h-3 text-rose-400" />
                              <span>{nukingId === p.id ? 'Zeroizing…' : 'Zeroize'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                  {/* Chatrooms */}
                  {(activeTab === 'overview' || activeTab === 'chat') &&
                    filteredChatRooms.map((r) => {
                      const secondsLeft = Math.max(0, Math.floor((r.expiresAt - Date.now()) / 1000));
                      return (
                        <tr key={r.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 pl-2 font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-400" />
                            <span>{r.id}</span>
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              CHATROOM
                            </span>
                          </td>
                          <td className="py-3 text-slate-300 font-sans">
                            {r.messageCount} msg(s) · {r.burnedCount} auto-burned
                          </td>
                          <td className="py-3 text-slate-300">{r.memberCount} member(s)</td>
                          <td className="py-3 text-amber-400 font-bold font-mono">
                            {Math.floor(secondsLeft / 60)}m {secondsLeft % 60}s
                          </td>
                          <td className="py-3 text-right pr-2">
                            <button
                              onClick={() => handleNukeRoom(r.id)}
                              disabled={nukingId === r.id}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[11px] font-sans font-bold flex items-center gap-1 ml-auto cursor-pointer transition-all"
                            >
                              <Trash2 className="w-3 h-3 text-rose-400" />
                              <span>{nukingId === r.id ? 'Destroying…' : 'Zeroize'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                  {filteredPods.length === 0 && filteredChatRooms.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                        No active ephemeral entities matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
