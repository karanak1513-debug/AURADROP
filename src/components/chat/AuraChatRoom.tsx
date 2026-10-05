'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Video,
  Smile,
  Trash2,
  Shield,
  Users,
  Clock,
  Copy,
  Check,
  CheckCheck,
  X,
  CornerDownLeft,
  Lock,
  Download,
  Eye,
  EyeOff,
  Flame,
  Phone,
  LogOut,
  Info,
  Timer,
  Share2,
  Key,
  QrCode,
  MessageCircle,
  ShieldCheck,
  ChevronDown,
  Zap,
  MoreHorizontal,
  ShieldOff,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import {
  encryptText,
  decryptText,
  encryptFileBuffer,
  decryptFileBuffer,
} from '@/lib/crypto';
import { ChatMember, ChatMessageType, EncryptedChatMessage } from '@/lib/chatStore';
import { sound } from '@/lib/sound';
import { useAuth } from '@/context/AuthContext';
import { UserSessionPill } from '@/components/auth/UserSessionPill';
import { SocialShareModal } from '@/components/workspace/SocialShareModal';
import { PodMetadata } from '@/types/vault';
import {
  PrivacyGuardShield,
  PrivacyShieldButton,
  SecurityIncident,
} from '@/components/chat/PrivacyGuardShield';

// ── Types ────────────────────────────────────────────────────────────────────

interface DecryptedMessage {
  id: string;
  roomId: string;
  timestamp: number;
  senderId: string;
  senderCodename: string;
  senderColor: string;
  senderEmoji: string;
  senderDisplayName?: string;
  senderPhotoURL?: string;
  type: ChatMessageType;
  text?: string;
  mediaUrl?: string;
  mediaName?: string;
  mediaMimeType?: string;
  mediaSize?: number;
  replyToId?: string;
  replyToText?: string;
  reactions?: Record<string, string[]>;
  isDeleted?: boolean;
  isPending?: boolean;
  mediaId?: string;
  deliveredTo?: string[];
  readBy?: Record<string, number>;
  isBurnOnRead?: boolean;
  burnDurationSeconds?: number;
  burnTriggeredAt?: number;
  isBurned?: boolean;
  isRevealed?: boolean;
  burnRemainingSeconds?: number;
}

interface AuraChatRoomProps {
  roomId: string;
  salt: string;
  cryptoKey: CryptoKey;
  passphrase: string;
  currentMember: ChatMember;
  onLeave: () => void;
  onPanic: () => void;
  isHost: boolean;
  expiresAt: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const EMOJI_REACTIONS = ['❤️', '😂', '🔥', '👍', '😮', '💀', '🎉', '🫡'];
const AVATAR_EMOJIS = ['🥷', '🦊', '🐉', '👾', '🤖', '🦁', '🐺', '🦅', '🎭', '🧊', '⚡', '🌙'];

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatRelativeTime(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return formatTime(ts);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCountdown(secondsLeft: number): string {
  if (secondsLeft <= 0) return '00:00:00';
  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

function isImageMime(mime?: string) { return mime?.startsWith('image/') ?? false; }
function isVideoMime(mime?: string) { return mime?.startsWith('video/') ?? false; }

// ── Main Component ───────────────────────────────────────────────────────────

export function AuraChatRoom({
  roomId,
  salt: _salt,
  cryptoKey,
  passphrase,
  currentMember,
  onLeave,
  onPanic,
  isHost,
  expiresAt,
}: AuraChatRoomProps) {
  const { user: authUser } = useAuth();
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingMembers, setTypingMembers] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<DecryptedMessage | null>(null);
  const [emojiPickerFor, setEmojiPickerFor] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ msgId: string; x: number; y: number } | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedRoomId, setCopiedRoomId] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [showPasswordInInfo, setShowPasswordInInfo] = useState(false);
  const [copiedInstagramInfo, setCopiedInstagramInfo] = useState(false);
  const [copiedDirectLink, setCopiedDirectLink] = useState(false);
  const [showShieldConfig, setShowShieldConfig] = useState(false);
  const [externalShieldIncident, setExternalShieldIncident] = useState<SecurityIncident | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
  const [mediaPreview, setMediaPreview] = useState<{
    url: string; type: string; name: string; msgId?: string; isBurnOnRead?: boolean; burnRemainingSeconds?: number;
  } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [burnMode, setBurnMode] = useState<number | null>(null);
  const [showBurnMenu, setShowBurnMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedIds = useRef<Set<string>>(new Set());
  const objectUrlsRef = useRef<string[]>([]);

  // ── Countdown timer ──────────────────────────────────────────────────────
  useEffect(() => {
    const tick = setInterval(() => {
      const s = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setSecondsLeft(s);
    }, 1000);
    return () => clearInterval(tick);
  }, [expiresAt]);

  useEffect(() => {
    return () => { objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url)); };
  }, []);

  // ── Scroll logic ─────────────────────────────────────────────────────────
  const scrollToBottom = useCallback((force = false) => {
    if (!messagesContainerRef.current) return;
    const el = messagesContainerRef.current;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom || force) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setIsScrolledUp(false);
      setUnreadCount(0);
    } else {
      setIsScrolledUp(true);
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages.length, scrollToBottom]);

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const el = messagesContainerRef.current;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setIsScrolledUp(!atBottom);
    if (atBottom) setUnreadCount(0);
  };

  // ── Decrypt ───────────────────────────────────────────────────────────────
  const decryptMessage = useCallback(
    async (msg: EncryptedChatMessage): Promise<DecryptedMessage | null> => {
      if (processedIds.current.has(msg.id)) return null;
      processedIds.current.add(msg.id);

      const base: DecryptedMessage = {
        id: msg.id, roomId: msg.roomId, timestamp: msg.timestamp,
        senderId: msg.senderId, senderCodename: msg.senderCodename,
        senderColor: msg.senderColor, senderEmoji: msg.senderEmoji || '🥷',
        senderDisplayName: msg.senderDisplayName, senderPhotoURL: msg.senderPhotoURL,
        type: msg.type, reactions: msg.reactions, replyToId: msg.replyToId,
        isDeleted: msg.isDeleted, mediaMimeType: msg.mediaMimeType, mediaSize: msg.mediaSize,
        mediaId: msg.mediaId, deliveredTo: msg.deliveredTo || [], readBy: msg.readBy || {},
        isBurnOnRead: msg.isBurnOnRead, burnDurationSeconds: msg.burnDurationSeconds,
        burnTriggeredAt: msg.burnTriggeredAt, isBurned: msg.isBurned,
        isRevealed: msg.senderId === currentMember.id,
        burnRemainingSeconds: msg.burnDurationSeconds,
      };

      if (msg.isBurned) return { ...base, text: '🔥 Vaporized: Content purged from memory (0 bytes remain)' };
      if (msg.isDeleted) return { ...base, text: '[Message deleted]' };
      if (msg.type === 'system') return { ...base, text: msg.encryptedPayload };

      try {
        if (msg.type === 'text' || msg.type === 'emoji_reaction') {
          const text = await decryptText(msg.encryptedPayload, msg.iv, cryptoKey);
          return { ...base, text };
        }
        if (msg.type === 'image' || msg.type === 'video' || msg.type === 'file') {
          const metaJson = await decryptText(msg.encryptedPayload, msg.iv, cryptoKey);
          const meta = JSON.parse(metaJson) as { name: string; size: number; mimeType: string };
          return { ...base, mediaName: meta.name, mediaSize: meta.size, mediaMimeType: meta.mimeType };
        }
      } catch (err) {
        console.error('[AuraChat] Decryption failed for msg', msg.id, err);
        return { ...base, text: '🔒 [Decryption failed — wrong key?]' };
      }
      return base;
    },
    [cryptoKey]
  );

  // ── SSE Stream ───────────────────────────────────────────────────────────
  useEffect(() => {
    const streamUrl = `/api/rooms/${encodeURIComponent(roomId)}/stream?memberId=${encodeURIComponent(currentMember.id)}`;
    const es = new EventSource(streamUrl);

    es.onmessage = async (event) => {
      try {
        const { type, payload } = JSON.parse(event.data) as { type: string; payload: unknown };

        if (type === 'initial_state') {
          const p = payload as { members: ChatMember[]; messages: EncryptedChatMessage[] };
          setMembers(p.members);
          const decrypted: DecryptedMessage[] = [];
          for (const m of p.messages) { const d = await decryptMessage(m); if (d) decrypted.push(d); }
          setMessages(decrypted);
          const unreadIds = p.messages.filter(m => m.senderId !== currentMember.id && !m.isDeleted && !m.isBurned && !m.isBurnOnRead && (!m.readBy || !m.readBy[currentMember.id])).map(m => m.id);
          if (unreadIds.length > 0 && typeof document !== 'undefined' && !document.hidden) {
            fetch(`/api/rooms/${encodeURIComponent(roomId)}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: 'mark_read', payload: { messageIds: unreadIds, memberId: currentMember.id } }) }).catch(() => {});
          }
        } else if (type === 'new_message') {
          const m = payload as EncryptedChatMessage;
          const d = await decryptMessage(m);
          if (d) {
            setMessages(prev => [...prev, d]);
            if (m.senderId !== currentMember.id) {
              sound.playClick?.();
              setUnreadCount(prev => (isScrolledUp ? prev + 1 : 0));
              if (!m.isBurnOnRead && typeof document !== 'undefined' && !document.hidden) {
                fetch(`/api/rooms/${encodeURIComponent(roomId)}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: 'mark_read', payload: { messageIds: [m.id], memberId: currentMember.id } }) }).catch(() => {});
              }
            }
          }
        } else if (type === 'messages_read') {
          const p = payload as { messageIds: string[]; memberId: string; readAt: number };
          setMessages(prev => {
            let hasMyMsg = false;
            const updated = prev.map(m => {
              if (p.messageIds.includes(m.id)) {
                if (m.senderId === currentMember.id) hasMyMsg = true;
                return { ...m, readBy: { ...(m.readBy || {}), [p.memberId]: p.readAt }, deliveredTo: Array.from(new Set([...(m.deliveredTo || []), p.memberId])) };
              }
              return m;
            });
            if (hasMyMsg && p.memberId !== currentMember.id) sound.playTick?.();
            return updated;
          });
        } else if (type === 'burn_triggered') {
          const p = payload as { messageId: string; burnTriggeredAt: number; burnDurationSeconds: number; triggeredBy: string };
          setMessages(prev => prev.map(m => m.id === p.messageId ? { ...m, burnTriggeredAt: p.burnTriggeredAt, burnDurationSeconds: p.burnDurationSeconds, burnRemainingSeconds: p.burnDurationSeconds } : m));
        } else if (type === 'message_burned') {
          const p = payload as { messageId: string };
          setMessages(prev => prev.map(m => { if (m.id === p.messageId) { if (m.mediaUrl) { try { URL.revokeObjectURL(m.mediaUrl); } catch {} } return { ...m, isBurned: true, mediaUrl: undefined, burnRemainingSeconds: 0, text: '🔥 Vaporized: Content purged from memory (0 bytes remain)' }; } return m; }));
          sound.playBurn?.();
        } else if (type === 'member_joined') {
          const p = payload as { member: ChatMember; memberCount: number };
          setMembers(prev => { const existing = prev.find(m => m.id === p.member.id); if (existing) return prev.map(m => m.id === p.member.id ? { ...m, ...p.member } : m); return [...prev, p.member]; });
        } else if (type === 'member_left') {
          const p = payload as { memberId: string };
          setMembers(prev => prev.filter(m => m.id !== p.memberId));
        } else if (type === 'typing_update') {
          const p = payload as { members: ChatMember[] };
          setMembers(p.members);
          setTypingMembers(p.members.filter(m => m.isTyping && m.id !== currentMember.id).map(m => m.codename));
        } else if (type === 'message_deleted') {
          const p = payload as { messageId: string };
          setMessages(prev => prev.map(m => m.id === p.messageId ? { ...m, isDeleted: true, text: '[Message deleted]' } : m));
        } else if (type === 'reaction_update') {
          const p = payload as { messageId: string; reactions: Record<string, string[]> };
          setMessages(prev => prev.map(m => m.id === p.messageId ? { ...m, reactions: p.reactions } : m));
        } else if (type === 'screen_capture_alert') {
          const p = payload as { memberId: string; codename: string; timestamp?: number };
          const ts = p.timestamp || Date.now();
          const inc: SecurityIncident = { id: `inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, codename: p.codename, memberId: p.memberId, timestamp: ts, type: 'screenshot' };
          setExternalShieldIncident(inc);
          const sysMsg: DecryptedMessage = { id: `sys-shield-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, roomId, timestamp: ts, senderId: 'system', senderCodename: 'AURA SHIELD', senderColor: '#EF4444', senderEmoji: '📸', type: 'system', text: `📸 [SECURITY AUDIT] Screen capture attempt by "${p.codename}" detected. Timestamp logged.` };
          setMessages(prev => [...prev, sysMsg]);
        } else if (type === 'room_destroyed') {
          sound.playNuke?.();
          onLeave();
        }
      } catch (err) { console.error('[AuraChat] SSE parse error', err); }
    };

    es.onerror = () => {};

    const pingInterval = setInterval(() => {
      fetch(`/api/rooms/${encodeURIComponent(roomId)}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: 'ping', payload: { memberId: currentMember.id, isTyping } }) }).catch(() => {});
    }, 20_000);

    return () => {
      es.close();
      clearInterval(pingInterval);
      fetch(`/api/rooms/${encodeURIComponent(roomId)}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: 'leave', payload: { memberId: currentMember.id } }) }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, cryptoKey, currentMember.id]);

  // ── Auto-read ─────────────────────────────────────────────────────────────
  const markUnreadMessagesAsRead = useCallback(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    setMessages(prev => {
      const unreadIds: string[] = [];
      for (const m of prev) {
        if (m.senderId !== currentMember.id && !m.isDeleted && !m.isBurned && (!m.readBy || !m.readBy[currentMember.id]) && !m.isBurnOnRead) unreadIds.push(m.id);
      }
      if (unreadIds.length === 0) return prev;
      const now = Date.now();
      const updated = prev.map(m => unreadIds.includes(m.id) ? { ...m, readBy: { ...(m.readBy || {}), [currentMember.id]: now }, deliveredTo: Array.from(new Set([...(m.deliveredTo || []), currentMember.id])) } : m);
      fetch(`/api/rooms/${encodeURIComponent(roomId)}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: 'mark_read', payload: { messageIds: unreadIds, memberId: currentMember.id } }) }).catch(() => {});
      return updated;
    });
  }, [currentMember.id, roomId]);

  useEffect(() => { markUnreadMessagesAsRead(); }, [messages.length, markUnreadMessagesAsRead]);
  useEffect(() => { const h = () => markUnreadMessagesAsRead(); window.addEventListener('focus', h); return () => window.removeEventListener('focus', h); }, [markUnreadMessagesAsRead]);

  // ── Auto-burn countdown ───────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setMessages(prev => {
        let changed = false;
        const now = Date.now();
        const updated = prev.map(m => {
          if (m.isBurnOnRead && m.burnTriggeredAt && !m.isBurned) {
            const elapsed = Math.floor((now - m.burnTriggeredAt) / 1000);
            const remaining = Math.max(0, (m.burnDurationSeconds ?? 0) - elapsed);
            if (remaining !== m.burnRemainingSeconds) {
              changed = true;
              if (remaining <= 0) {
                if (m.mediaUrl) { try { URL.revokeObjectURL(m.mediaUrl); } catch {} }
                sound.playBurn?.();
                return { ...m, isBurned: true, mediaUrl: undefined, burnRemainingSeconds: 0, text: '🔥 Vaporized: Content purged from memory (0 bytes remain)' };
              }
              return { ...m, burnRemainingSeconds: remaining };
            }
          }
          return m;
        });
        return changed ? updated : prev;
      });
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // ── Single-use reveal & burn ──────────────────────────────────────────────
  const handleRevealSingleUse = async (msg: DecryptedMessage) => {
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isRevealed: true, burnTriggeredAt: Date.now(), burnRemainingSeconds: m.burnDurationSeconds ?? 0 } : m));
    sound.playClick?.();
    try {
      await fetch(`/api/rooms/${encodeURIComponent(roomId)}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: 'mark_read', payload: { messageIds: [msg.id], memberId: currentMember.id } }) });
      await fetch(`/api/rooms/${encodeURIComponent(roomId)}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: 'trigger_burn', payload: { messageId: msg.id, memberId: currentMember.id } }) });
    } catch (err) { console.error('[AuraChat] Reveal error:', err); }
  };

  const handleBurnNow = async (messageId: string) => {
    try {
      await fetch(`/api/rooms/${encodeURIComponent(roomId)}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: 'burn_now', payload: { messageId, reason: 'MANUAL_PURGE' } }) });
      setMessages(prev => prev.map(m => { if (m.id === messageId) { if (m.mediaUrl) { try { URL.revokeObjectURL(m.mediaUrl); } catch {} } return { ...m, isBurned: true, mediaUrl: undefined, burnRemainingSeconds: 0, text: '🔥 Vaporized: Content purged from memory (0 bytes remain)' }; } return m; }));
      sound.playBurn?.();
    } catch (err) { console.error('[AuraChat] Burn now error:', err); }
  };

  // ── Typing indicator ──────────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (!isTyping) {
      setIsTyping(true);
      fetch(`/api/rooms/${encodeURIComponent(roomId)}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: 'ping', payload: { memberId: currentMember.id, isTyping: true } }) }).catch(() => {});
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      fetch(`/api/rooms/${encodeURIComponent(roomId)}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: 'ping', payload: { memberId: currentMember.id, isTyping: false } }) }).catch(() => {});
    }, 2500);
  };

  // ── Send text ─────────────────────────────────────────────────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);

    const isBurn = burnMode !== null;
    const duration = burnMode !== null ? burnMode : undefined;

    try {
      const { ciphertext, iv } = await encryptText(text, cryptoKey);
      const senderDisplayName = authUser?.displayName || undefined;
      const senderPhotoURL = authUser?.photoURL || undefined;
      const senderCodename = authUser?.displayName || currentMember.codename;

      const msg: EncryptedChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        roomId, timestamp: Date.now(), senderId: currentMember.id, senderCodename,
        senderColor: currentMember.color, senderEmoji: currentMember.avatarEmoji,
        senderDisplayName, senderPhotoURL, type: 'text', encryptedPayload: ciphertext, iv,
        replyToId: replyTo?.id, deliveredTo: [], readBy: {}, isBurnOnRead: isBurn, burnDurationSeconds: duration,
      };

      const optimistic: DecryptedMessage = {
        ...msg, text, senderDisplayName, senderPhotoURL, isPending: true,
        replyToId: replyTo?.id, replyToText: replyTo?.text?.substring(0, 80),
        isBurnOnRead: isBurn, burnDurationSeconds: duration, isRevealed: true, burnRemainingSeconds: duration,
      };
      processedIds.current.add(msg.id);
      setMessages(prev => [...prev, optimistic]);
      setReplyTo(null);
      sound.playKey?.();

      await fetch(`/api/rooms/${encodeURIComponent(roomId)}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: 'send_message', payload: msg }) });
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isPending: false } : m));
    } catch (err) { console.error('[AuraChat] Send error:', err); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e as unknown as React.FormEvent); }
  };

  // ── File upload ───────────────────────────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fileInputRef.current) return;
    fileInputRef.current.value = '';
    if (file.size > 25 * 1024 * 1024) { alert('File too large. Max 25 MB.'); return; }
    setUploadProgress(0);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { encryptedBlob } = await encryptFileBuffer(arrayBuffer, file.name, file.type, cryptoKey, (pct) => setUploadProgress(Math.floor(pct * 0.7)));
      const mediaId = `media-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const formData = new FormData();
      formData.append('file', encryptedBlob, file.name);
      formData.append('mediaId', mediaId);
      formData.append('uploadedBy', currentMember.id);
      setUploadProgress(70);
      const uploadRes = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/media`, { method: 'POST', body: formData });
      if (!uploadRes.ok) throw new Error('Upload failed');
      setUploadProgress(85);
      const metaJson = JSON.stringify({ name: file.name, size: file.size, mimeType: file.type });
      const { ciphertext, iv } = await encryptText(metaJson, cryptoKey);
      const msgType: ChatMessageType = isImageMime(file.type) ? 'image' : isVideoMime(file.type) ? 'video' : 'file';
      const isBurn = burnMode !== null;
      const duration = burnMode !== null ? burnMode : undefined;
      const senderDisplayName = authUser?.displayName || undefined;
      const senderPhotoURL = authUser?.photoURL || undefined;
      const senderCodename = authUser?.displayName || currentMember.codename;
      const msg: EncryptedChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        roomId, timestamp: Date.now(), senderId: currentMember.id, senderCodename,
        senderColor: currentMember.color, senderEmoji: currentMember.avatarEmoji,
        senderDisplayName, senderPhotoURL, type: msgType, encryptedPayload: ciphertext, iv,
        mediaId, mediaMimeType: file.type, mediaSize: file.size, deliveredTo: [], readBy: {},
        isBurnOnRead: isBurn, burnDurationSeconds: duration,
      };
      const localUrl = URL.createObjectURL(file);
      objectUrlsRef.current.push(localUrl);
      const optimistic: DecryptedMessage = { ...msg, mediaName: file.name, senderDisplayName, senderPhotoURL, mediaSize: file.size, mediaMimeType: file.type, mediaUrl: localUrl, isPending: false, isBurnOnRead: isBurn, burnDurationSeconds: duration, isRevealed: true, burnRemainingSeconds: duration };
      processedIds.current.add(msg.id);
      setMessages(prev => [...prev, optimistic]);
      setUploadProgress(100);
      await fetch(`/api/rooms/${encodeURIComponent(roomId)}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: 'send_message', payload: msg }) });
      setTimeout(() => setUploadProgress(null), 800);
    } catch (err) { console.error('[AuraChat] Upload error:', err); setUploadProgress(null); alert('Upload failed. Please try again.'); }
  };

  // ── Download media ────────────────────────────────────────────────────────
  const handleDownloadMedia = async (msg: DecryptedMessage) => {
    if (!msg.mediaId) return;
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/media?mediaId=${encodeURIComponent(msg.mediaId)}`);
      if (!res.ok) throw new Error('Media fetch failed');
      const encBuf = await res.arrayBuffer();
      const { decryptedBlob, metadata } = await decryptFileBuffer(encBuf, cryptoKey);
      const url = URL.createObjectURL(decryptedBlob);
      objectUrlsRef.current.push(url);
      if (isImageMime(metadata.mimeType) || isVideoMime(metadata.mimeType)) setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, mediaUrl: url } : m));
      if (msg.isBurnOnRead && msg.senderId !== currentMember.id && !msg.burnTriggeredAt) handleRevealSingleUse(msg);
      const a = document.createElement('a'); a.href = url; a.download = metadata.name; a.click();
    } catch (err) { console.error('[AuraChat] Download/decrypt error:', err); alert('Decryption failed — wrong key or file corrupted.'); }
  };

  // ── Reactions ─────────────────────────────────────────────────────────────
  const handleReact = async (msgId: string, emoji: string) => {
    setEmojiPickerFor(null); setContextMenu(null);
    try {
      await fetch(`/api/rooms/${encodeURIComponent(roomId)}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: 'react', payload: { messageId: msgId, emoji, memberId: currentMember.id } }) });
    } catch (err) { console.error('[AuraChat] React error:', err); }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDeleteMessage = async (msgId: string) => {
    setContextMenu(null);
    try {
      await fetch(`/api/rooms/${encodeURIComponent(roomId)}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: 'delete_message', payload: { messageId: msgId, requesterId: currentMember.id } }) });
    } catch (err) { console.error('[AuraChat] Delete error:', err); }
  };

  // ── Share helpers ─────────────────────────────────────────────────────────
  const getDirectJoinUrl = useCallback(() => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    const isRoomRoute = window.location.pathname.startsWith('/room/');
    const base = `${origin}/${isRoomRoute ? 'room' : 'chat'}/${roomId}`;
    return passphrase ? `${base}#key=${encodeURIComponent(passphrase)}` : base;
  }, [roomId, passphrase]);

  const handleCopyLink = () => {
    const link = getDirectJoinUrl();
    navigator.clipboard.writeText(link).then(() => { setCopiedDirectLink(true); setCopied(true); sound.playSuccess?.(); setTimeout(() => { setCopiedDirectLink(false); setCopied(false); }, 2000); });
  };
  const handleCopyRoomId = () => { navigator.clipboard.writeText(roomId).then(() => { setCopiedRoomId(true); sound.playSuccess?.(); setTimeout(() => setCopiedRoomId(false), 2000); }); };
  const handleCopyPassword = () => { if (!passphrase) return; navigator.clipboard.writeText(passphrase).then(() => { setCopiedPassword(true); sound.playSuccess?.(); setTimeout(() => setCopiedPassword(false), 2000); }); };
  const handleShareWhatsApp = () => { const link = getDirectJoinUrl(); const text = `🔒 Join my secure Aura Chatroom:\n\n• Room ID: ${roomId}\n• Password: ${passphrase || 'None'}\n• 1-Tap Auto-Join: ${link}\n\n⏳ End-to-end encrypted · Zero trace`; window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank'); };
  const handleCopyInstagram = () => { const link = getDirectJoinUrl(); const caption = `✨ Secret Chat on Aura Drop\n• Room ID: ${roomId}\n• Password: ${passphrase || 'None'}\n🔗 Auto-Join: ${link}\n🔒 Zero-knowledge ephemeral messaging`; navigator.clipboard.writeText(caption).then(() => { setCopiedInstagramInfo(true); sound.playSuccess?.(); setTimeout(() => setCopiedInstagramInfo(false), 2500); }); };

  const shareMetadata: PodMetadata = useMemo(() => ({
    id: roomId, salt: _salt || '', createdAt: Date.now(), expiresAt, ttlSeconds: secondsLeft,
    burnOnDownload: false, burnOnEmpty: false, readOnlyGuests: false, creatorPeerId: currentMember.id, isZeroized: false,
  }), [roomId, _salt, expiresAt, secondsLeft, currentMember.id]);

  const getReplySource = useCallback((replyToId?: string): DecryptedMessage | undefined => {
    if (!replyToId) return undefined;
    return messages.find(m => m.id === replyToId);
  }, [messages]);

  const onlineMembers = useMemo(() => members.filter(m => Date.now() - m.lastPing < 55_000), [members]);
  const isUrgent = secondsLeft < 300;

  // ── Message bubble renderer ───────────────────────────────────────────────
  const renderMessage = (msg: DecryptedMessage, index: number) => {
    const isMe = msg.senderId === currentMember.id;
    const isSystem = msg.senderId === 'system';
    const replySource = getReplySource(msg.replyToId);
    const showDate = index === 0 || new Date(messages[index - 1].timestamp).toDateString() !== new Date(msg.timestamp).toDateString();
    const isBurned = msg.isBurned;
    const isSingleUse = msg.isBurnOnRead && !isBurned;
    const isUnrevealedRecipient = isSingleUse && !isMe && !msg.isRevealed;
    const isReadByOthers = msg.readBy && Object.keys(msg.readBy).some(peerId => peerId !== currentMember.id);
    const isDeliveredToOthers = (msg.deliveredTo && msg.deliveredTo.some(peerId => peerId !== currentMember.id)) || onlineMembers.length > 1;
    const readers = msg.readBy ? Object.keys(msg.readBy).filter(id => id !== currentMember.id) : [];

    return (
      <React.Fragment key={msg.id}>
        {showDate && (
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-[10px] font-semibold text-white/30 bg-white/5 px-3 py-1 rounded-full border border-white/10 backdrop-blur-sm">
              {new Date(msg.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            <div className="flex-1 h-px bg-white/8" />
          </div>
        )}

        {/* System message */}
        {isSystem && (
          <div className="flex justify-center my-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px] font-semibold backdrop-blur-sm max-w-[85%]">
              <span className="text-rose-400">🛡</span>
              <span>{msg.text}</span>
            </div>
          </div>
        )}

        {/* Regular message */}
        {!isSystem && (
          <div className={`group flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end mb-1`}>
            {/* Avatar */}
            {!isMe && (
              <div
                className="w-8 h-8 rounded-2xl flex items-center justify-center text-sm shrink-0 border overflow-hidden"
                style={{ backgroundColor: `${msg.senderColor}20`, borderColor: `${msg.senderColor}30` }}
              >
                {msg.senderPhotoURL ? (
                  <img src={msg.senderPhotoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : msg.senderEmoji}
              </div>
            )}

            <div className={`flex flex-col max-w-[72%] ${isMe ? 'items-end' : 'items-start'}`}>
              {/* Sender name */}
              {!isMe && !msg.isDeleted && (
                <span className="text-[10px] font-bold mb-1 ml-1 flex items-center gap-1.5" style={{ color: msg.senderColor }}>
                  <span>{msg.senderDisplayName || msg.senderCodename}</span>
                  {msg.senderPhotoURL && (
                    <span className="text-[8px] font-extrabold px-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Google</span>
                  )}
                </span>
              )}

              {/* Reply quote */}
              {replySource && !msg.isDeleted && !isBurned && (
                <div className={`text-[10px] px-2.5 py-1.5 rounded-xl mb-1.5 border-l-2 max-w-full truncate ${isMe ? 'bg-white/5 border-indigo-400 text-white/50' : 'bg-white/5 border-indigo-400 text-white/50'}`}>
                  <span className="font-semibold" style={{ color: replySource.senderColor }}>{replySource.senderCodename}: </span>
                  {replySource.text?.substring(0, 60)}{(replySource.text?.length ?? 0) > 60 ? '…' : ''}
                </div>
              )}

              {/* Burned */}
              {isBurned ? (
                <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/8 text-white/40 text-xs">
                  <div className="w-6 h-6 rounded-lg bg-rose-500/15 flex items-center justify-center shrink-0">
                    <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                  </div>
                  <div>
                    <p className="font-semibold text-white/50 text-[11px]">Vaporized</p>
                    <p className="text-[10px] text-white/25">Content purged from memory</p>
                  </div>
                </div>
              ) : isUnrevealedRecipient ? (
                /* Unrevealed single-use */
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-transparent border border-amber-400/20 backdrop-blur-md flex flex-col items-center text-center gap-2.5 max-w-[260px]">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 animate-pulse">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center justify-center gap-1.5 mb-1">
                      Single-Use Vault Item
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-400/20">
                        {msg.burnDurationSeconds === 0 ? 'VIEW-ONCE' : `${msg.burnDurationSeconds}S BURN`}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/40 leading-snug">
                      {msg.burnDurationSeconds === 0 ? 'Vaporizes immediately upon reading.' : 'Self-destruct timer starts on reveal.'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRevealSingleUse(msg)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-orange-500 hover:opacity-95 text-white text-xs font-bold shadow-lg shadow-rose-500/25 active:scale-95 transition-all cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Tap to Reveal & Start Burn</span>
                  </button>
                </div>
              ) : (
                /* Normal bubble */
                <div
                  className={`relative rounded-2xl text-xs leading-relaxed transition-all ${
                    msg.isDeleted
                      ? 'italic text-white/25 bg-white/5 border border-white/8 px-4 py-2.5'
                      : isMe
                      ? 'text-white px-4 py-2.5 shadow-lg'
                      : 'text-white/90 px-4 py-2.5 border border-white/10'
                  } ${msg.isPending ? 'opacity-50' : ''}`}
                  style={isMe ? {
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 60%, #06b6d4 100%)',
                    boxShadow: '0 4px 20px -4px rgba(99,102,241,0.5)',
                  } : msg.isDeleted ? {} : {
                    background: 'rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(12px)',
                  }}
                  onContextMenu={(e) => {
                    if (msg.isDeleted) return;
                    e.preventDefault();
                    setContextMenu({ msgId: msg.id, x: e.clientX, y: e.clientY });
                  }}
                >
                  {/* Single-use countdown bar */}
                  {isSingleUse && (
                    <div className={`flex items-center justify-between gap-2 px-2.5 py-1 mb-2 rounded-xl text-[10px] font-bold ${isMe ? 'bg-white/15 text-white border border-white/20' : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'}`}>
                      <span className="flex items-center gap-1.5">
                        <Flame className="w-3 h-3 text-rose-400 animate-bounce" />
                        {msg.burnTriggeredAt ? `Vaporizing in ${msg.burnRemainingSeconds ?? msg.burnDurationSeconds}s` : isMe ? `Single-Use (${msg.burnDurationSeconds === 0 ? '1-View' : `${msg.burnDurationSeconds}s`})` : 'Self-Destruct Active'}
                      </span>
                      {!isMe && (
                        <button onClick={() => handleBurnNow(msg.id)} className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-rose-500 text-white hover:bg-rose-600 cursor-pointer">Burn Now</button>
                      )}
                    </div>
                  )}

                  {/* Burn progress bar */}
                  {isSingleUse && msg.burnTriggeredAt && (
                    <div className="w-full h-0.5 bg-white/10 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-rose-500 transition-all duration-500"
                        style={{ width: `${Math.max(0, Math.min(100, (((msg.burnRemainingSeconds ?? msg.burnDurationSeconds ?? 1) / (msg.burnDurationSeconds || 1)) * 100)))}%` }}
                      />
                    </div>
                  )}

                  {/* Text */}
                  {(msg.type === 'text' || msg.type === 'system') && (
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  )}

                  {/* Image */}
                  {msg.type === 'image' && !msg.isDeleted && (
                    <div className="rounded-xl overflow-hidden max-w-[240px]">
                      {msg.mediaUrl ? (
                        <img src={msg.mediaUrl} alt={msg.mediaName || 'Image'} className="max-w-full max-h-[280px] object-cover cursor-pointer rounded-xl" onClick={() => msg.mediaUrl && setMediaPreview({ url: msg.mediaUrl, type: msg.mediaMimeType || 'image/jpeg', name: msg.mediaName || 'image', msgId: msg.id, isBurnOnRead: msg.isBurnOnRead, burnRemainingSeconds: msg.burnRemainingSeconds ?? msg.burnDurationSeconds })} />
                      ) : (
                        <div className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-white/10 transition-colors rounded-xl" onClick={() => handleDownloadMedia(msg)}>
                          <ImageIcon className="w-4 h-4 shrink-0 text-white/60" />
                          <div className="min-w-0"><p className="font-semibold truncate">{msg.mediaName || 'Image'}</p>{msg.mediaSize && <p className="text-[10px] opacity-50">{formatBytes(msg.mediaSize)} · Click to decrypt</p>}</div>
                          <Eye className="w-3.5 h-3.5 shrink-0 opacity-50" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Video */}
                  {msg.type === 'video' && !msg.isDeleted && (
                    <div className="rounded-xl overflow-hidden max-w-[260px]">
                      {msg.mediaUrl ? (
                        <video src={msg.mediaUrl} controls className="max-w-full max-h-[220px] rounded-xl" preload="metadata" />
                      ) : (
                        <div className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-white/10 transition-colors rounded-xl" onClick={() => handleDownloadMedia(msg)}>
                          <Video className="w-4 h-4 shrink-0 text-white/60" />
                          <div className="min-w-0"><p className="font-semibold truncate">{msg.mediaName || 'Video'}</p>{msg.mediaSize && <p className="text-[10px] opacity-50">{formatBytes(msg.mediaSize)}</p>}</div>
                          <Download className="w-3.5 h-3.5 shrink-0 opacity-50" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* File */}
                  {msg.type === 'file' && !msg.isDeleted && (
                    <div className="flex items-center gap-2.5 cursor-pointer hover:bg-white/8 transition-colors px-1 py-0.5 rounded-xl" onClick={() => handleDownloadMedia(msg)}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${isMe ? 'bg-white/15' : 'bg-indigo-500/15'}`}>📎</div>
                      <div className="min-w-0 flex-1"><p className="font-semibold truncate">{msg.mediaName || 'File'}</p>{msg.mediaSize && <p className="text-[10px] opacity-50">{formatBytes(msg.mediaSize)}</p>}</div>
                      <Download className="w-3.5 h-3.5 shrink-0 opacity-50" />
                    </div>
                  )}

                  {msg.isPending && <div className="flex justify-end mt-1"><div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse" /></div>}
                </div>
              )}

              {/* Reactions */}
              {msg.reactions && Object.keys(msg.reactions).length > 0 && !isBurned && (
                <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {Object.entries(msg.reactions).map(([emoji, reactors]) => (
                    <button key={emoji} onClick={() => handleReact(msg.id, emoji)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${reactors.includes(currentMember.id) ? 'bg-indigo-500/20 border-indigo-400/30 text-indigo-300' : 'bg-white/5 border-white/10 text-white/50 hover:border-indigo-400/30'}`}>
                      <span>{emoji}</span><span>{reactors.length}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Timestamp & read receipts */}
              <div className={`flex items-center gap-1.5 mt-1 mx-1 text-[10px] text-white/25 ${isMe ? 'justify-end' : 'justify-start'}`}>
                <span>{formatRelativeTime(msg.timestamp)}</span>
                {msg.isPending && <span className="flex items-center gap-1 text-white/30"><Clock className="w-3 h-3 animate-spin" /> Sending…</span>}
                {isMe && !msg.isPending && (
                  <div className="flex items-center gap-1">
                    {isBurned ? (
                      <span className="flex items-center gap-0.5 text-rose-400 font-semibold"><Flame className="w-3 h-3" /> Burned</span>
                    ) : isReadByOthers ? (
                      <div className="relative group/ticks flex items-center cursor-pointer">
                        <CheckCheck className="w-3.5 h-3.5 text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.9)] stroke-[2.5]" />
                        <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover/ticks:flex flex-col bg-slate-900/95 text-white text-[10px] px-2.5 py-1.5 rounded-xl shadow-xl border border-white/10 whitespace-nowrap z-30 pointer-events-none backdrop-blur-md">
                          <div className="font-semibold text-cyan-300 flex items-center gap-1 mb-1"><CheckCheck className="w-3 h-3" /> Read by:</div>
                          {readers.map(rId => { const m = members.find(mem => mem.id === rId); const readAt = msg.readBy?.[rId]; return (<span key={rId} className="text-white/60 flex items-center gap-1">{m?.avatarEmoji || '🥷'} {m?.codename || rId.substring(0, 8)}{readAt ? ` (${formatTime(readAt)})` : ''}</span>); })}
                        </div>
                      </div>
                    ) : isDeliveredToOthers ? (
                      <CheckCheck className="w-3.5 h-3.5 text-white/30 stroke-[2]" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-white/30 stroke-[2]" />
                    )}
                    {msg.isBurnOnRead && !msg.isBurned && (
                      <span className="flex items-center gap-0.5 text-[9px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-400/20 px-1.5 py-0.5 rounded-full">
                        <Flame className="w-2.5 h-2.5" />
                        {msg.burnTriggeredAt ? `${msg.burnRemainingSeconds ?? msg.burnDurationSeconds}s` : msg.burnDurationSeconds === 0 ? '1-View' : `${msg.burnDurationSeconds}s`}
                      </span>
                    )}
                  </div>
                )}
                {!isMe && msg.isBurnOnRead && !msg.isBurned && msg.burnTriggeredAt && (
                  <span className="flex items-center gap-0.5 text-[9px] font-bold text-rose-400 bg-rose-500/10 border border-rose-400/20 px-1.5 py-0.5 rounded-full animate-pulse">
                    <Flame className="w-2.5 h-2.5" /> {msg.burnRemainingSeconds ?? msg.burnDurationSeconds}s left
                  </span>
                )}
              </div>
            </div>

            {/* Hover action buttons */}
            {!msg.isDeleted && (
              <div className={`flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'items-end' : 'items-start'}`}>
                <button onClick={() => setEmojiPickerFor(emojiPickerFor === msg.id ? null : msg.id)} className="p-1.5 rounded-full bg-white/8 hover:bg-white/15 border border-white/10 text-white/40 hover:text-white/70 cursor-pointer transition-all" title="React">
                  <Smile className="w-3 h-3" />
                </button>
                <button onClick={() => setReplyTo(msg)} className="p-1.5 rounded-full bg-white/8 hover:bg-white/15 border border-white/10 text-white/40 hover:text-white/70 cursor-pointer transition-all" title="Reply">
                  <CornerDownLeft className="w-3 h-3" />
                </button>
                {(isMe || isHost) && (
                  <button onClick={() => handleDeleteMessage(msg.id)} className="p-1.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400/60 hover:text-rose-400 cursor-pointer transition-all" title="Delete">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Emoji picker */}
        {emojiPickerFor === msg.id && (
          <div className={`flex gap-1.5 mt-1 mb-1 flex-wrap p-2 bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 ${isMe ? 'justify-end mr-10' : 'ml-10'}`}>
            {EMOJI_REACTIONS.map(emoji => (
              <button key={emoji} onClick={() => handleReact(msg.id, emoji)} className="text-lg hover:scale-125 transition-transform cursor-pointer p-1 rounded-xl hover:bg-white/10">{emoji}</button>
            ))}
            <button onClick={() => setEmojiPickerFor(null)} className="p-1.5 rounded-xl hover:bg-white/10 text-white/40 cursor-pointer"><X className="w-3 h-3" /></button>
          </div>
        )}
      </React.Fragment>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col h-[100dvh] max-h-[100dvh] w-full overflow-hidden font-sans"
      style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #0d1117 40%, #0a0f1e 100%)' }}
      onClick={() => { setContextMenu(null); setEmojiPickerFor(null); setShowBurnMenu(false); }}
    >
      {/* ── Premium Dark Header ── */}
      <header
        className="shrink-0 px-4 py-0 flex items-center gap-3 z-30 relative"
        style={{
          background: 'rgba(13,17,27,0.85)',
          backdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 1px 0 0 rgba(99,102,241,0.1), 0 8px 32px -8px rgba(0,0,0,0.5)',
        }}
      >
        {/* Specular top rim */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent pointer-events-none" />

        {/* Left: Room identity & AuraDrop Logo */}
        <div className="flex items-center gap-3 flex-1 min-w-0 py-3">
          <Link
            href="/"
            title="Return to AuraDrop Home"
            className="relative w-10 h-10 rounded-2xl overflow-hidden p-[1px] bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 shrink-0 hover:scale-105 transition-all shadow-md cursor-pointer group"
          >
            <Image
              src="/logo.png"
              alt="AuraDrop Logo"
              width={40}
              height={40}
              className="w-full h-full object-cover rounded-2xl"
              priority
            />
            {/* Online glow dot */}
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0d1117]" style={{ boxShadow: '0 0 8px rgba(52,211,153,0.8)' }} />
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-heading font-bold text-white tracking-tight truncate" style={{ fontSize: '14px' }}>{roomId}</h1>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${isUrgent ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'}`}>
                {isUrgent ? '⚡ URGENT' : '● LIVE'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-white/35 mt-0.5">
              <Clock className="w-3 h-3" />
              <span className={`font-mono font-semibold tabular-nums ${isUrgent ? 'text-rose-400' : 'text-white/50'}`}>{formatCountdown(secondsLeft)}</span>
              <span className="text-white/15">·</span>
              <Users className="w-3 h-3" />
              <span>{onlineMembers.length} online</span>
              <span className="text-white/15">·</span>
              <Lock className="w-3 h-3 text-indigo-400" />
              <span className="text-indigo-400 font-medium">E2EE</span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <PrivacyShieldButton onClick={() => setShowShieldConfig(true)} hasActiveAlert={!!externalShieldIncident} />

          <button
            onClick={() => setShowSocialModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer active:scale-95 border"
            style={{ background: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.25)', color: '#a5b4fc' }}
            title="Share room"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Share</span>
          </button>

          <button
            onClick={() => { setShowMembers(!showMembers); setShowRoomInfo(false); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${showMembers ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' : 'bg-white/5 border-white/8 text-white/50 hover:bg-white/8'}`}
            title="Members"
          >
            <Users className="w-3.5 h-3.5" />
            <span>{onlineMembers.length}</span>
          </button>

          <button
            onClick={() => { setShowRoomInfo(!showRoomInfo); setShowMembers(false); }}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${showRoomInfo ? 'bg-slate-700/60 border-white/15 text-white' : 'bg-white/5 border-white/8 text-white/40 hover:bg-white/8'}`}
            title="Room info"
          >
            <Info className="w-4 h-4" />
          </button>

          <UserSessionPill />

          <div className="w-px h-5 bg-white/8 mx-0.5" />

          <button onClick={onLeave} className="p-2 rounded-xl bg-white/5 hover:bg-white/8 border border-white/8 text-white/40 hover:text-amber-400 transition-all cursor-pointer" title="Leave room">
            <LogOut className="w-4 h-4" />
          </button>

          {isHost && (
            <button onClick={onPanic} className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer shadow-lg" style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 4px 12px rgba(239,68,68,0.3)', color: 'white' }} title="Emergency Panic destroy">
              <Flame className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Panic</span>
            </button>
          )}
        </div>
      </header>

      {/* ── 3-Panel Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT SIDEBAR: Members ── */}
        <aside
          className="shrink-0 flex flex-col border-r transition-all duration-300 ease-in-out overflow-hidden"
          style={{
            width: showMembers ? '240px' : '0px',
            background: 'rgba(13,17,27,0.8)',
            backdropFilter: 'blur(20px)',
            borderColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <div className="px-4 py-3.5 border-b border-white/6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <span className="font-heading font-bold text-sm text-white whitespace-nowrap">Members</span>
              <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">{onlineMembers.length}</span>
            </div>
            <button onClick={() => setShowMembers(false)} className="p-1 rounded-full hover:bg-white/8 cursor-pointer text-white/30 hover:text-white/60 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {onlineMembers.map(m => (
              <div key={m.id} className="flex items-center gap-2.5 p-2.5 rounded-xl border transition-colors" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 border" style={{ backgroundColor: `${m.color}15`, borderColor: `${m.color}20` }}>
                  {m.avatarEmoji}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate" style={{ color: m.color }}>
                    {m.codename}{m.id === currentMember.id ? <span className="text-white/20 font-normal ml-1 text-[10px]">(You)</span> : null}
                  </p>
                  <p className="text-[10px] text-white/30">{m.isHost ? '👑 Host' : 'Member'}{m.isTyping ? ' · typing…' : ''}</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.7)' }} />
              </div>
            ))}
          </div>

          <div className="border-t border-white/6 p-3 space-y-2 shrink-0">
            <div className="p-3 rounded-xl border" style={{ background: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.15)' }}>
              <p className="text-[10px] font-bold text-indigo-400 flex items-center gap-1.5 mb-0.5"><Shield className="w-3 h-3" />E2EE Active</p>
              <p className="text-[9px] text-indigo-400/50">AES-256-GCM encrypted</p>
            </div>
            <div className="p-3 rounded-xl border" style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.15)' }}>
              <p className="text-[10px] font-bold text-amber-400 flex items-center gap-1.5 mb-0.5"><Clock className="w-3 h-3" />Destroys In</p>
              <p className="text-[11px] font-mono font-bold text-amber-400">{formatCountdown(secondsLeft)}</p>
            </div>
          </div>
        </aside>

        {/* ── CENTER: Chat Canvas ── */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 relative">
          <PrivacyGuardShield
            roomId={roomId}
            currentCodename={currentMember.codename}
            currentMemberId={currentMember.id}
            externalIncident={externalShieldIncident}
            forceOpenConfig={showShieldConfig}
            onCloseConfig={() => setShowShieldConfig(false)}
            onAlertBroadcast={(inc) => {
              const sysMsg: DecryptedMessage = { id: `sys-shield-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, roomId, timestamp: inc.timestamp, senderId: 'system', senderCodename: 'AURA SHIELD', senderColor: '#EF4444', senderEmoji: '📸', type: 'system', text: `📸 [SECURITY AUDIT] Screen capture attempt triggered on your client. Room notified.` };
              setMessages(prev => [...prev, sysMsg]);
            }}
          >

          {/* Room info flyout */}
          {showRoomInfo && (
            <div
              className="absolute right-0 top-0 bottom-0 w-80 z-40 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
              style={{ background: 'rgba(10,12,20,0.97)', backdropFilter: 'blur(28px)', borderLeft: '1px solid rgba(255,255,255,0.06)', boxShadow: '-12px 0 40px -8px rgba(0,0,0,0.6)' }}
            >
              <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center text-indigo-400"><Info className="w-4 h-4" /></div>
                  <div><h3 className="font-heading font-bold text-sm text-white leading-tight">Room Info & Access</h3><p className="text-[10px] text-white/30">Credentials & invite links</p></div>
                </div>
                <button onClick={() => setShowRoomInfo(false)} className="p-1.5 rounded-full hover:bg-white/8 cursor-pointer text-white/30 hover:text-white/60 transition-colors"><X className="w-4 h-4" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
                {/* Quick invite */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-white/25 uppercase tracking-wider block">Quick Invite</span>
                  <button type="button" onClick={handleShareWhatsApp} className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-emerald-500/8 hover:bg-emerald-500/12 border border-emerald-500/15 text-emerald-400 transition-all cursor-pointer font-bold active:scale-[0.98]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[#25D366] text-white flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                      </div>
                      <div className="text-left"><span className="block text-[11px] font-extrabold text-emerald-300 leading-tight">Share to WhatsApp</span><span className="block text-[10px] text-emerald-500/60 font-normal">Sends ID, password & join link</span></div>
                    </div>
                    <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold">1-Tap</span>
                  </button>

                  <button type="button" onClick={handleCopyInstagram} className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-pink-500/8 hover:bg-pink-500/12 border border-pink-500/15 text-pink-300 transition-all cursor-pointer font-bold active:scale-[0.98]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#FD1D1D] via-[#E1306C] to-[#833AB4] text-white flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                      </div>
                      <div className="text-left"><span className="block text-[11px] font-extrabold text-pink-200 leading-tight">{copiedInstagramInfo ? 'Copied for Instagram!' : 'Copy for Instagram'}</span><span className="block text-[10px] text-pink-500/60 font-normal">Ready for Story, Bio or DM</span></div>
                    </div>
                    <span className="text-[10px] bg-gradient-to-r from-[#FD1D1D] to-[#E1306C] text-white px-2 py-0.5 rounded-full font-bold">{copiedInstagramInfo ? 'Done!' : 'Copy'}</span>
                  </button>
                </div>

                {/* Credentials */}
                <div className="p-3.5 rounded-2xl border space-y-3" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}>
                  <span className="text-[10px] font-bold text-white/25 uppercase tracking-wider block">Room Credentials</span>
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-white/40 mb-1"><span>Room ID</span><span className="text-[10px] text-white/20">Share with joiner</span></div>
                    <div className="flex items-center gap-1.5">
                      <code className="flex-1 font-mono text-[11px] font-bold px-3 py-1.5 rounded-xl border text-white/70 break-all select-all" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>{roomId}</code>
                      <button type="button" onClick={handleCopyRoomId} className="p-2 rounded-xl border text-white/40 hover:text-white/70 cursor-pointer shrink-0 transition-colors" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
                        {copiedRoomId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-white/40 mb-1"><span>Secret Password</span><span className="text-[10px] text-white/20">Required to unlock</span></div>
                    <div className="flex items-center gap-1.5">
                      <code className="flex-1 font-mono text-[11px] font-bold px-3 py-1.5 rounded-xl border text-white/70 break-all select-all" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>{passphrase ? (showPasswordInInfo ? passphrase : '••••••••••••') : 'None'}</code>
                      {passphrase && (
                        <button type="button" onClick={() => setShowPasswordInInfo(!showPasswordInInfo)} className="p-2 rounded-xl border text-white/30 hover:text-white/60 cursor-pointer shrink-0" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
                          {showPasswordInInfo ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <button type="button" onClick={handleCopyPassword} disabled={!passphrase} className="p-2 rounded-xl border text-white/40 hover:text-white/70 cursor-pointer shrink-0 transition-colors disabled:opacity-30" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
                        {copiedPassword ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-white/40 mb-1"><span>Auto-Join Link</span><span className="text-[10px] text-indigo-400">Bypasses password</span></div>
                    <div className="flex items-center gap-1.5">
                      <input type="text" readOnly value={getDirectJoinUrl()} className="flex-1 font-mono text-[10px] px-2.5 py-1.5 rounded-xl border text-white/40 truncate select-all focus:outline-none" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }} />
                      <button type="button" onClick={handleCopyLink} className="px-2.5 py-1.5 rounded-xl text-white text-[11px] font-bold cursor-pointer shrink-0 transition-colors flex items-center gap-1" style={{ background: 'linear-gradient(135deg,#6366f1,#06b6d4)' }}>
                        {copiedDirectLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedDirectLink ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* QR Hub */}
                <button type="button" onClick={() => { setShowSocialModal(true); setShowRoomInfo(false); }} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-white font-bold text-xs cursor-pointer transition-all active:scale-[0.99]" style={{ background: 'linear-gradient(135deg,#6366f1,#06b6d4)', boxShadow: '0 4px 16px rgba(99,102,241,0.3)' }}>
                  <QrCode className="w-4 h-4" />
                  <span>Show QR Code & All Share Options</span>
                </button>

                {/* Security status */}
                <div className="p-3 rounded-xl border space-y-2" style={{ background: 'rgba(52,211,153,0.05)', borderColor: 'rgba(52,211,153,0.1)' }}>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-emerald-400 text-[11px] flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />Privacy Guard & Capture Shield</p>
                    <span className="text-[9px] bg-emerald-500/15 text-emerald-400 font-extrabold px-1.5 py-0.5 rounded-full border border-emerald-500/20">ARMED</span>
                  </div>
                  <p className="text-emerald-400/50 text-[10px] leading-tight">Window blur concealment, screenshot alert broadcast & anti-leak watermark active.</p>
                  <button type="button" onClick={() => setShowShieldConfig(true)} className="w-full py-1.5 px-2.5 rounded-lg font-bold text-[10px] cursor-pointer transition-colors text-white" style={{ background: 'rgba(52,211,153,0.15)' }}>Configure Shield & Test Alert</button>
                </div>

                <div className="p-3 rounded-xl border" style={{ background: 'rgba(99,102,241,0.05)', borderColor: 'rgba(99,102,241,0.1)' }}>
                  <p className="font-bold text-indigo-400 mb-1 flex items-center gap-1.5 text-[11px]"><Shield className="w-3.5 h-3.5" /> End-to-End Encrypted</p>
                  <p className="text-indigo-400/50 leading-relaxed text-[10px]">AES-256-GCM. Keys never touch any server.</p>
                </div>
                <div className="p-3 rounded-xl border" style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.1)' }}>
                  <p className="font-bold text-amber-400 mb-1 flex items-center gap-1.5 text-[11px]"><Clock className="w-3.5 h-3.5" /> Self-Destructing</p>
                  <p className="text-amber-400/50 leading-relaxed text-[10px]">Destroys in <span className="font-mono font-bold text-amber-400">{formatCountdown(secondsLeft)}</span>. All data vaporizes.</p>
                </div>
              </div>
            </div>
          )}

          {/* Upload progress */}
          {uploadProgress !== null && (
            <div className="shrink-0 border-b border-white/6 px-6 py-2.5 flex items-center gap-3" style={{ background: 'rgba(13,17,27,0.9)' }}>
              <span className="text-[11px] font-semibold text-white/50">Encrypting & uploading…</span>
              <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%`, background: 'linear-gradient(90deg,#6366f1,#06b6d4)' }} />
              </div>
              <span className="text-[11px] font-mono font-semibold text-indigo-400">{uploadProgress}%</span>
            </div>
          )}

          {/* ── Messages Area ── */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-5 py-5 space-y-1"
            style={{ scrollBehavior: 'smooth' }}
          >
            {/* Welcome state */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-8 py-16">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-6" style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(6,182,212,0.1))', border: '1px solid rgba(99,102,241,0.15)', boxShadow: '0 20px 40px -15px rgba(99,102,241,0.2)' }}>
                  🔒
                </div>
                <h2 className="font-heading font-bold text-white text-xl mb-3 tracking-tight">Encrypted Room Active</h2>
                <p className="text-sm text-white/30 max-w-sm leading-relaxed mb-6">
                  Send messages, photos, videos, and files. Everything is encrypted on your device — the server never reads your content.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {[
                    { icon: Shield, label: 'AES-256-GCM E2EE', color: 'emerald' },
                    { icon: Lock, label: 'Zero Knowledge', color: 'indigo' },
                    { icon: Flame, label: 'Self-Destructing', color: 'amber' },
                  ].map(({ icon: Icon, label, color }) => (
                    <div key={label} className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border`}
                      style={{ background: `rgba(var(--${color}-rgb,99,102,241),0.08)`, borderColor: `rgba(var(--${color}-rgb,99,102,241),0.15)`, color: color === 'emerald' ? '#34d399' : color === 'indigo' ? '#818cf8' : '#fbbf24' }}>
                      <Icon className="w-3.5 h-3.5" />{label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, index) => renderMessage(msg, index))}

            {/* Typing indicator */}
            {typingMembers.length > 0 && (
              <div className="flex items-center gap-2 ml-11 mt-2">
                <div className="rounded-2xl px-4 py-3 flex items-center gap-2.5 border" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400" style={{ animation: `aura-bounce 1.2s ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                  <span className="text-[11px] text-white/30 font-medium">
                    {typingMembers.join(', ')} {typingMembers.length === 1 ? 'is' : 'are'} typing
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Scroll-to-bottom FAB */}
          {isScrolledUp && (
            <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20">
              <button onClick={() => scrollToBottom(true)} className="flex items-center gap-2 px-4 py-2 rounded-full text-white text-[11px] font-bold shadow-2xl cursor-pointer transition-all hover:scale-105 active:scale-95" style={{ background: 'linear-gradient(135deg,#6366f1,#06b6d4)', boxShadow: '0 8px 24px rgba(99,102,241,0.4)' }}>
                <ChevronDown className="w-4 h-4" />
                {unreadCount > 0 ? `${unreadCount} new` : 'Scroll down'}
              </button>
            </div>
          )}

          {/* ── Bottom Input Zone ── */}
          <div
            className="shrink-0"
            style={{ background: 'rgba(10,12,20,0.92)', backdropFilter: 'blur(24px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            {/* Reply banner */}
            {replyTo && (
              <div className="px-5 pt-3 pb-0 flex items-center gap-3">
                <div className="flex-1 min-w-0 rounded-xl px-3 py-2 flex items-center gap-2 border" style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.15)' }}>
                  <div className="w-px h-5 bg-indigo-400 rounded-full shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-indigo-400">Replying to {replyTo.senderCodename}</p>
                    <p className="text-[11px] text-white/40 truncate">{replyTo.text?.substring(0, 80)}</p>
                  </div>
                </div>
                <button onClick={() => setReplyTo(null)} className="p-1.5 rounded-full hover:bg-white/8 text-white/30 cursor-pointer shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Burn mode banner */}
            {burnMode !== null && (
              <div className="px-5 pt-2 pb-0 flex items-center gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0 rounded-xl px-3 py-2 border" style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.08),rgba(239,68,68,0.05))', borderColor: 'rgba(245,158,11,0.15)' }}>
                  <div className="w-5 h-5 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <Flame className="w-3 h-3 animate-pulse" />
                  </div>
                  <p className="text-[11px] font-bold text-amber-400 truncate">
                    SINGLE-USE BURN: <span className="font-normal text-amber-400/60">{burnMode === 0 ? 'View-Once — vaporizes on open' : `${burnMode}s self-destruct after open`}</span>
                  </p>
                </div>
                <button onClick={() => setBurnMode(null)} className="p-1.5 rounded-full hover:bg-white/8 text-amber-500/60 cursor-pointer shrink-0"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {/* Main input */}
            <div className="px-3 sm:px-4 pt-2 sm:pt-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <div
                className="flex items-end gap-2 sm:gap-3 rounded-2xl px-3 sm:px-4 py-2 sm:py-3 transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {/* Left actions */}
                <div className="flex items-center gap-0.5 shrink-0 pb-0.5">
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip,.rar" onChange={handleFileSelect} />
                  <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-xl hover:bg-white/8 text-white/30 hover:text-white/60 transition-colors cursor-pointer" title="Attach file">
                    <Paperclip className="w-4 h-4" />
                  </button>

                  {/* Burn mode selector */}
                  <div className="relative flex items-center">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setShowBurnMenu(!showBurnMenu); }}
                      className={`p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${burnMode !== null ? 'text-white shadow-sm' : 'hover:bg-white/8 text-white/30 hover:text-white/60'}`}
                      style={burnMode !== null ? { background: 'linear-gradient(135deg,#f59e0b,#ef4444)', boxShadow: '0 2px 8px rgba(239,68,68,0.3)' } : {}}
                      title="Self-Destruct Mode"
                    >
                      <Flame className="w-4 h-4" />
                      {burnMode !== null && <span className="text-[10px] font-mono font-bold">{burnMode === 0 ? '1×' : `${burnMode}s`}</span>}
                    </button>

                    {showBurnMenu && (
                      <div
                        className="absolute bottom-full left-0 mb-2 w-56 rounded-2xl border py-2 z-50"
                        style={{ background: 'rgba(10,12,20,0.98)', backdropFilter: 'blur(24px)', borderColor: 'rgba(255,255,255,0.08)', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="px-3 py-1.5 border-b border-white/6">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Self-Destruct Mode</p>
                          <p className="text-[10px] text-white/20">Purges content upon opening</p>
                        </div>
                        <div className="py-1">
                          {[
                            { value: null, label: 'Off (Room Lifetime)', icon: Shield, color: 'text-white/50' },
                            { value: 0, label: 'View Once (Instant Burn)', icon: Eye, color: 'text-rose-400' },
                            { value: 5, label: '5 Seconds Auto-Burn', icon: Timer, color: 'text-amber-400' },
                            { value: 10, label: '10 Seconds Auto-Burn', icon: Timer, color: 'text-amber-400' },
                            { value: 30, label: '30 Seconds Auto-Burn', icon: Timer, color: 'text-amber-400' },
                            { value: 60, label: '60 Seconds Auto-Burn', icon: Timer, color: 'text-amber-400' },
                          ].map(({ value, label, icon: Icon, color }) => (
                            <button key={String(value)} type="button" onClick={() => { setBurnMode(value); setShowBurnMenu(false); }}
                              className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-white/5 cursor-pointer ${burnMode === value ? 'text-indigo-400 font-bold' : 'text-white/40'}`}>
                              <span className="flex items-center gap-2"><Icon className={`w-3.5 h-3.5 ${color}`} /><span>{label}</span></span>
                              {burnMode === value && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Textarea + Send */}
                <form onSubmit={handleSend} className="flex-1 flex items-end gap-2 sm:gap-3">
                  <textarea
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={burnMode !== null ? `Self-destructing message (${burnMode === 0 ? 'View-Once' : `${burnMode}s`})…` : 'Send an encrypted message…'}
                    rows={1}
                    className="flex-1 bg-transparent border-none outline-none resize-none text-base sm:text-sm text-white/85 placeholder:text-white/20 max-h-[120px] overflow-y-auto py-0.5"
                    style={{ minHeight: '22px' }}
                    onInput={(e) => { const el = e.target as HTMLTextAreaElement; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 120)}px`; }}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="p-2.5 rounded-xl text-white transition-all disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer shrink-0 active:scale-90"
                    style={burnMode !== null
                      ? { background: 'linear-gradient(135deg,#f59e0b,#ef4444)', boxShadow: '0 4px 12px rgba(239,68,68,0.4)' }
                      : { background: 'linear-gradient(135deg,#6366f1,#06b6d4)', boxShadow: '0 4px 12px rgba(99,102,241,0.4)' }
                    }
                    title="Send"
                  >
                    {burnMode !== null ? <Flame className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>
              </div>

              {/* Status row */}
              <div className="hidden sm:flex items-center justify-center mt-2 gap-3 text-[10px] text-white/25">
                <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-indigo-400" />AES-256-GCM Encrypted</span>
                <span className="text-white/10">·</span>
                <span className="flex items-center gap-1"><CheckCheck className="w-3 h-3 text-sky-400" />Blue Tick Receipts</span>
                <span className="text-white/10">·</span>
                <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-amber-400" />Single-Use Self-Destruct</span>
                <span className="text-white/10">·</span>
                <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-400" />Privacy Guard</span>
              </div>
            </div>
          </div>

          </PrivacyGuardShield>
        </main>
      </div>

      {/* ── Context Menu ── */}
      {contextMenu && (
        <div
          className="fixed z-50 rounded-2xl border py-1.5 w-44"
          style={{ left: contextMenu.x, top: contextMenu.y, background: 'rgba(10,12,20,0.98)', backdropFilter: 'blur(24px)', borderColor: 'rgba(255,255,255,0.08)', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-white/60 hover:bg-white/5 cursor-pointer" onClick={() => { const msg = messages.find(m => m.id === contextMenu.msgId); if (msg) setReplyTo(msg); setContextMenu(null); }}>
            <CornerDownLeft className="w-3.5 h-3.5 text-indigo-400" /> Reply
          </button>
          <button className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-white/60 hover:bg-white/5 cursor-pointer" onClick={() => { setEmojiPickerFor(contextMenu.msgId); setContextMenu(null); }}>
            <Smile className="w-3.5 h-3.5 text-amber-400" /> React
          </button>
          <div className="h-px bg-white/6 my-1" />
          <button className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-rose-400/70 hover:bg-rose-500/8 cursor-pointer" onClick={() => handleDeleteMessage(contextMenu.msgId)}>
            <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Delete
          </button>
        </div>
      )}

      {/* ── Media Lightbox ── */}
      {mediaPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)' }}
          onClick={() => { if (mediaPreview.isBurnOnRead && mediaPreview.msgId) handleBurnNow(mediaPreview.msgId); setMediaPreview(null); }}
        >
          {mediaPreview.isBurnOnRead && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full text-white text-xs font-bold shadow-lg backdrop-blur-md z-20 animate-pulse" style={{ background: 'rgba(239,68,68,0.85)', boxShadow: '0 4px 16px rgba(239,68,68,0.4)' }}>
              <Flame className="w-4 h-4" />
              <span>Single-Use Item • Vaporizing in {mediaPreview.burnRemainingSeconds !== undefined ? `${mediaPreview.burnRemainingSeconds}s` : '5s'}</span>
            </div>
          )}
          <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer z-10" onClick={() => { if (mediaPreview.isBurnOnRead && mediaPreview.msgId) handleBurnNow(mediaPreview.msgId); setMediaPreview(null); }}>
            <X className="w-5 h-5" />
          </button>
          {isImageMime(mediaPreview.type) ? (
            <img src={mediaPreview.url} alt={mediaPreview.name} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
          ) : (
            <video src={mediaPreview.url} controls autoPlay className="max-w-full max-h-full rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
          )}
          <p className="absolute bottom-6 text-white/30 text-xs">{mediaPreview.name}</p>
        </div>
      )}

      {/* Social Share Modal */}
      <SocialShareModal isOpen={showSocialModal} onClose={() => setShowSocialModal(false)} metadata={shareMetadata} passphrase={passphrase} secondsRemaining={secondsLeft} />

      {/* Typing bounce animation */}
      <style jsx>{`
        @keyframes aura-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}

// ── Avatar/Emoji & Color Constants (exported for reuse) ──────────────────────
export { AVATAR_EMOJIS };
