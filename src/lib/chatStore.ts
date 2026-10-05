/**
 * AURA CHAT — Ephemeral Chat Room Engine
 * Zero-Knowledge In-Memory Store
 * Messages are relayed (never decrypted server-side)
 * All content vaporizes on room expiry or panic wipe
 */

export type ChatRoomTTL = '15m' | '1h' | '6h' | '24h';

export interface ChatMember {
  id: string;
  codename: string;
  color: string;
  avatarEmoji: string;
  joinedAt: number;
  lastPing: number;
  isHost: boolean;
  isTyping: boolean;
  displayName?: string;
  photoURL?: string;
  email?: string;
}

export type ChatMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'file'
  | 'emoji_reaction'
  | 'system';

export interface EncryptedChatMessage {
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
  // AES-256-GCM encrypted payload (text or file metadata as JSON)
  encryptedPayload: string;
  iv: string;
  // For media — server stores encrypted binary blob temporarily
  mediaId?: string;
  mediaMimeType?: string;
  mediaSize?: number;
  replyToId?: string;
  reactions?: Record<string, string[]>; // emoji -> [peerId, ...]
  isDeleted?: boolean;
  // Blue Tick Read Receipts
  deliveredTo?: string[];               // [peerId, ...]
  readBy?: Record<string, number>;      // peerId -> read timestamp
  // Automatic Single-Use Self-Destruct
  isBurnOnRead?: boolean;               // True if marked for single-use auto-burn
  burnDurationSeconds?: number;         // 0 = view-once instant, 5 = 5s, 10 = 10s, 30 = 30s, etc.
  burnTriggeredAt?: number;             // Timestamp when recipient viewed/opened
  isBurned?: boolean;                   // True if shredded / vaporized
}

export interface ChatRoomMetadata {
  id: string;
  salt: string;        // PBKDF2 salt (Base64) — server never sees passphrase
  createdAt: number;
  expiresAt: number;
  ttlSeconds: number;
  hostPeerId: string;
  memberCount: number;
  maxMembers: number;
  burnOnEmpty: boolean;
  isDestroyed: boolean;
  messageCount: number;
}

export interface ChatRoomFullState {
  metadata: ChatRoomMetadata;
  members: ChatMember[];
  messages: EncryptedChatMessage[]; // relay-only; server never decrypts
}

export interface StoredMediaBlob {
  mediaId: string;
  roomId: string;
  encryptedBuffer: Buffer;  // Pre-encrypted by client; server stores blindly
  mimeType: string;
  size: number;
  uploadedAt: number;
  uploadedBy: string;
}

// ── Global In-Memory Store ──────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __auraChatRooms: Map<string, ChatRoomFullState> | undefined;
  // eslint-disable-next-line no-var
  var __auraChatMedia: Map<string, StoredMediaBlob> | undefined;
  // eslint-disable-next-line no-var
  var __auraChatSubscribers: Map<string, Set<(event: { type: string; payload: unknown }) => void>> | undefined;
  // eslint-disable-next-line no-var
  var __auraChatBurnTimers: Map<string, ReturnType<typeof setTimeout>> | undefined;
  // eslint-disable-next-line no-var
  var __auraChatJanitorStarted: boolean | undefined;
}

const chatRooms = globalThis.__auraChatRooms ?? (globalThis.__auraChatRooms = new Map());
const chatMedia = globalThis.__auraChatMedia ?? (globalThis.__auraChatMedia = new Map());
const chatSubscribers = globalThis.__auraChatSubscribers ?? (globalThis.__auraChatSubscribers = new Map());
const chatBurnTimers = globalThis.__auraChatBurnTimers ?? (globalThis.__auraChatBurnTimers = new Map());

// ── TTL Janitor ─────────────────────────────────────────────────────────────

if (!globalThis.__auraChatJanitorStarted) {
  globalThis.__auraChatJanitorStarted = true;
  setInterval(async () => {
    const now = Date.now();
    for (const [roomId, room] of chatRooms.entries()) {
      if (room.metadata.expiresAt <= now || room.metadata.isDestroyed) {
        console.log(`[AURA CHAT JANITOR] Room [${roomId}] expired. Wiping.`);
        await destroyRoom(roomId, 'TTL_EXPIRED');
      }
    }
    // Also clean orphaned media blobs
    for (const [mediaId, blob] of chatMedia.entries()) {
      if (Date.now() - blob.uploadedAt > 24 * 60 * 60 * 1000) {
        blob.encryptedBuffer.fill(0);
        chatMedia.delete(mediaId);
      }
    }
  }, 15_000);
}

// ── TTL Map ──────────────────────────────────────────────────────────────────

const TTL_MAP: Record<ChatRoomTTL, number> = {
  '15m': 15 * 60,
  '1h': 60 * 60,
  '6h': 6 * 60 * 60,
  '24h': 24 * 60 * 60,
};

// ── Room Lifecycle ───────────────────────────────────────────────────────────

export interface CreateRoomConfig {
  id: string;
  salt: string;
  ttl: ChatRoomTTL;
  hostPeerId: string;
  maxMembers?: number;
  burnOnEmpty?: boolean;
}

export async function createChatRoom(config: CreateRoomConfig): Promise<ChatRoomMetadata> {
  const ttlSeconds = TTL_MAP[config.ttl] ?? TTL_MAP['1h'];
  const now = Date.now();

  const metadata: ChatRoomMetadata = {
    id: config.id,
    salt: config.salt,
    createdAt: now,
    expiresAt: now + ttlSeconds * 1000,
    ttlSeconds,
    hostPeerId: config.hostPeerId,
    memberCount: 0,
    maxMembers: config.maxMembers ?? 50,
    burnOnEmpty: config.burnOnEmpty ?? false,
    isDestroyed: false,
    messageCount: 0,
  };

  const fullState: ChatRoomFullState = {
    metadata,
    members: [],
    messages: [],
  };

  chatRooms.set(config.id, fullState);
  console.log(`[AURA CHAT] Room [${config.id}] created. TTL: ${config.ttl}`);
  return metadata;
}

export async function getChatRoom(roomId: string): Promise<ChatRoomFullState | null> {
  const room = chatRooms.get(roomId) || null;

  if (!room) return null;

  if (room.metadata.expiresAt <= Date.now() || room.metadata.isDestroyed) {
    await destroyRoom(roomId, 'EXPIRED_ON_ACCESS');
    return null;
  }

  return room;
}

export async function destroyRoom(roomId: string, reason: string): Promise<boolean> {
  const room = chatRooms.get(roomId);

  if (room) {
    // Wipe all media blobs for this room
    for (const [mediaId, blob] of chatMedia.entries()) {
      if (blob.roomId === roomId) {
        blob.encryptedBuffer.fill(0);
        chatMedia.delete(mediaId);
      }
    }

    room.metadata.isDestroyed = true;
    chatRooms.delete(roomId);

    // Cancel any active burn timers for this room
    for (const [key, timer] of chatBurnTimers.entries()) {
      if (key.startsWith(`${roomId}:`)) {
        clearTimeout(timer);
        chatBurnTimers.delete(key);
      }
    }
  }

  // Broadcast destroy to all SSE subscribers
  broadcastChat(roomId, { type: 'room_destroyed', payload: { reason, timestamp: Date.now() } });

  // Clean subscribers
  chatSubscribers.delete(roomId);

  console.log(`[AURA CHAT] Room [${roomId}] DESTROYED. Reason: ${reason}.`);
  return true;
}

// ── Member Management ────────────────────────────────────────────────────────

export async function joinRoom(
  roomId: string,
  member: ChatMember
): Promise<ChatRoomFullState | null> {
  const room = await getChatRoom(roomId);
  if (!room) return null;

  if (room.members.length >= room.metadata.maxMembers) {
    throw new Error('ROOM_FULL');
  }

  const existingIdx = room.members.findIndex((m: ChatMember) => m.id === member.id);
  if (existingIdx >= 0) {
    room.members[existingIdx] = { ...room.members[existingIdx], ...member, lastPing: Date.now() };
  } else {
    room.members.push({ ...member, lastPing: Date.now() });
    room.metadata.memberCount = room.members.length;

    // System join message (unencrypted system event, not a user message)
    broadcastChat(roomId, {
      type: 'member_joined',
      payload: { member, memberCount: room.members.length },
    });
  }

  // Prune stale members (no ping > 60s)
  room.members = room.members.filter((m: ChatMember) => Date.now() - m.lastPing < 60_000);
  chatRooms.set(roomId, room);

  return room;
}

export async function pingMember(
  roomId: string,
  memberId: string,
  isTyping = false
): Promise<void> {
  const room = chatRooms.get(roomId);
  if (!room) return;

  const member = room.members.find((m: ChatMember) => m.id === memberId);
  if (member) {
    member.lastPing = Date.now();
    if (member.isTyping !== isTyping) {
      member.isTyping = isTyping;
      broadcastChat(roomId, {
        type: 'typing_update',
        payload: {
          memberId,
          codename: member.codename,
          isTyping,
          members: room.members,
        },
      });
    }
  }

  // Prune stale members
  room.members = room.members.filter((m: ChatMember) => Date.now() - m.lastPing < 60_000);
  room.metadata.memberCount = room.members.length;
  chatRooms.set(roomId, room);
}

export async function leaveRoom(roomId: string, memberId: string): Promise<void> {
  const room = chatRooms.get(roomId);
  if (!room) return;

  const leavingMember = room.members.find((m: ChatMember) => m.id === memberId);
  room.members = room.members.filter((m: ChatMember) => m.id !== memberId);
  room.metadata.memberCount = room.members.length;

  if (leavingMember) {
    broadcastChat(roomId, {
      type: 'member_left',
      payload: { memberId, codename: leavingMember.codename, memberCount: room.members.length },
    });
  }

  // Burn on empty
  if (room.metadata.burnOnEmpty && room.members.length === 0) {
    await destroyRoom(roomId, 'BURN_ON_EMPTY');
    return;
  }

  chatRooms.set(roomId, room);
}

// ── Message Relay ────────────────────────────────────────────────────────────

export const MAX_MESSAGES_IN_MEMORY = 500;

export async function relayMessage(
  roomId: string,
  message: EncryptedChatMessage
): Promise<boolean> {
  const room = await getChatRoom(roomId);
  if (!room) return false;

  // Initialize deliveredTo with all active room members other than sender
  if (!message.deliveredTo) {
    message.deliveredTo = room.members
      .filter((m: ChatMember) => m.id !== message.senderId && Date.now() - m.lastPing < 60_000)
      .map((m: ChatMember) => m.id);
  }
  if (!message.readBy) {
    message.readBy = {};
  }

  room.messages.push(message);
  room.metadata.messageCount++;

  // Rolling window — never store more than MAX in memory
  if (room.messages.length > MAX_MESSAGES_IN_MEMORY) {
    room.messages = room.messages.slice(-MAX_MESSAGES_IN_MEMORY);
  }

  chatRooms.set(roomId, room);

  // Broadcast to all SSE subscribers
  broadcastChat(roomId, { type: 'new_message', payload: message });

  return true;
}

export async function deleteMessage(
  roomId: string,
  messageId: string,
  requesterId: string
): Promise<boolean> {
  const room = chatRooms.get(roomId);
  if (!room) return false;

  const msg = room.messages.find((m: EncryptedChatMessage) => m.id === messageId);
  if (!msg) return false;

  // Only sender or host can delete
  const requester = room.members.find((m: ChatMember) => m.id === requesterId);
  if (msg.senderId !== requesterId && !requester?.isHost) return false;

  msg.isDeleted = true;
  msg.encryptedPayload = '';
  msg.iv = '';
  if (msg.mediaId) {
    const blob = chatMedia.get(msg.mediaId);
    if (blob) {
      blob.encryptedBuffer.fill(0);
      chatMedia.delete(msg.mediaId);
    }
    msg.mediaId = undefined;
  }

  chatRooms.set(roomId, room);
  broadcastChat(roomId, { type: 'message_deleted', payload: { messageId } });
  return true;
}

export async function addReaction(
  roomId: string,
  messageId: string,
  emoji: string,
  memberId: string
): Promise<boolean> {
  const room = chatRooms.get(roomId);
  if (!room) return false;

  const msg = room.messages.find((m: EncryptedChatMessage) => m.id === messageId);
  if (!msg || msg.isDeleted) return false;

  if (!msg.reactions) msg.reactions = {};
  if (!msg.reactions[emoji]) msg.reactions[emoji] = [];

  const existing = msg.reactions[emoji].indexOf(memberId);
  if (existing >= 0) {
    msg.reactions[emoji].splice(existing, 1); // Toggle off
    if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
  } else {
    msg.reactions[emoji].push(memberId);
  }

  chatRooms.set(roomId, room);
  broadcastChat(roomId, {
    type: 'reaction_update',
    payload: { messageId, reactions: msg.reactions },
  });
  return true;
}

// ── Blue Tick Read Receipts & Single-Use Auto-Burn ─────────────────────────

export async function markMessagesRead(
  roomId: string,
  messageIds: string[],
  memberId: string
): Promise<{ readMessageIds: string[]; triggeredBurns: string[] }> {
  const room = chatRooms.get(roomId);
  if (!room) return { readMessageIds: [], triggeredBurns: [] };

  const now = Date.now();
  const readMessageIds: string[] = [];
  const triggeredBurns: string[] = [];

  for (const msgId of messageIds) {
    const msg = room.messages.find((m: EncryptedChatMessage) => m.id === msgId);
    if (!msg || msg.isDeleted || msg.isBurned) continue;
    // Don't mark self messages as read by self
    if (msg.senderId === memberId) continue;

    if (!msg.readBy) msg.readBy = {};
    if (!msg.deliveredTo) msg.deliveredTo = [];
    if (!msg.deliveredTo.includes(memberId)) {
      msg.deliveredTo.push(memberId);
    }

    if (!msg.readBy[memberId]) {
      msg.readBy[memberId] = now;
      readMessageIds.push(msgId);

      // Check if message is configured for automatic single-use burn
      if (msg.isBurnOnRead && !msg.burnTriggeredAt && !msg.isBurned) {
        msg.burnTriggeredAt = now;
        triggeredBurns.push(msgId);

        const duration = msg.burnDurationSeconds ?? 0;
        if (duration === 0) {
          // Instant view-once burn
          await burnMessage(roomId, msgId, 'VIEW_ONCE_BURN');
        } else {
          // Timed auto burn
          const timerKey = `${roomId}:${msgId}`;
          if (chatBurnTimers.has(timerKey)) {
            clearTimeout(chatBurnTimers.get(timerKey)!);
          }
          const timer = setTimeout(async () => {
            chatBurnTimers.delete(timerKey);
            await burnMessage(roomId, msgId, 'AUTO_BURN_TIMER_EXPIRED');
          }, duration * 1000);
          chatBurnTimers.set(timerKey, timer);

          broadcastChat(roomId, {
            type: 'burn_triggered',
            payload: {
              messageId: msgId,
              burnTriggeredAt: now,
              burnDurationSeconds: duration,
              triggeredBy: memberId,
            },
          });
        }
      }
    }
  }

  if (readMessageIds.length > 0) {
    chatRooms.set(roomId, room);
    broadcastChat(roomId, {
      type: 'messages_read',
      payload: {
        messageIds: readMessageIds,
        memberId,
        readAt: now,
      },
    });
  }

  return { readMessageIds, triggeredBurns };
}

export async function triggerMessageBurn(
  roomId: string,
  messageId: string,
  memberId: string
): Promise<boolean> {
  const room = chatRooms.get(roomId);
  if (!room) return false;

  const msg = room.messages.find((m: EncryptedChatMessage) => m.id === messageId);
  if (!msg || msg.isDeleted || msg.isBurned) return false;

  const now = Date.now();
  if (!msg.readBy) msg.readBy = {};
  msg.readBy[memberId] = now;

  if (msg.burnTriggeredAt) {
    return true;
  }

  msg.burnTriggeredAt = now;
  const duration = msg.burnDurationSeconds ?? 0;

  if (duration === 0) {
    await burnMessage(roomId, messageId, 'VIEW_ONCE_BURN');
    return true;
  }

  const timerKey = `${roomId}:${messageId}`;
  if (chatBurnTimers.has(timerKey)) {
    clearTimeout(chatBurnTimers.get(timerKey)!);
  }
  const timer = setTimeout(async () => {
    chatBurnTimers.delete(timerKey);
    await burnMessage(roomId, messageId, 'AUTO_BURN_TIMER_EXPIRED');
  }, duration * 1000);
  chatBurnTimers.set(timerKey, timer);

  chatRooms.set(roomId, room);

  broadcastChat(roomId, {
    type: 'burn_triggered',
    payload: {
      messageId,
      burnTriggeredAt: now,
      burnDurationSeconds: duration,
      triggeredBy: memberId,
    },
  });

  return true;
}

export async function burnMessage(
  roomId: string,
  messageId: string,
  reason = 'SINGLE_USE_BURN'
): Promise<boolean> {
  const room = chatRooms.get(roomId);
  if (!room) return false;

  const msg = room.messages.find((m: EncryptedChatMessage) => m.id === messageId);
  if (!msg) return false;

  // Clear timer if any
  const timerKey = `${roomId}:${messageId}`;
  if (chatBurnTimers.has(timerKey)) {
    clearTimeout(chatBurnTimers.get(timerKey)!);
    chatBurnTimers.delete(timerKey);
  }

  // DoD shred: wipe encrypted payload, iv, and media
  msg.isBurned = true;
  msg.encryptedPayload = '';
  msg.iv = '';

  if (msg.mediaId) {
    const blob = chatMedia.get(msg.mediaId);
    if (blob) {
      blob.encryptedBuffer.fill(0);
      chatMedia.delete(msg.mediaId);
    }
    msg.mediaId = undefined;
  }

  chatRooms.set(roomId, room);

  broadcastChat(roomId, {
    type: 'message_burned',
    payload: {
      messageId,
      burnedAt: Date.now(),
      reason,
    },
  });

  return true;
}

// ── Media Storage (Encrypted Blobs) ─────────────────────────────────────────

export async function storeMediaBlob(blob: StoredMediaBlob): Promise<void> {
  chatMedia.set(blob.mediaId, blob);
}

export async function getMediaBlob(mediaId: string): Promise<StoredMediaBlob | null> {
  return chatMedia.get(mediaId) || null;
}

// ── SSE PubSub ───────────────────────────────────────────────────────────────

export function subscribeChatRoom(
  roomId: string,
  callback: (event: { type: string; payload: unknown }) => void
): () => void {
  let subs = chatSubscribers.get(roomId);
  if (!subs) {
    subs = new Set();
    chatSubscribers.set(roomId, subs);
  }
  subs.add(callback);

  return () => {
    subs?.delete(callback);
    if (subs?.size === 0) chatSubscribers.delete(roomId);
  };
}

export function broadcastChat(
  roomId: string,
  event: { type: string; payload: unknown }
): void {
  const subs = chatSubscribers.get(roomId);
  if (!subs) return;
  for (const cb of subs) {
    try { cb(event); } catch { /* ignore individual subscriber errors */ }
  }
}

/**
 * Admin Telemetry for Ephemeral Chatrooms
 */
export function getChatAdminTelemetry() {
  const rooms: Array<{
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
  }> = [];

  let totalMessages = 0;
  let totalBurnedMessages = 0;
  let totalMediaBytes = 0;
  let totalMembers = 0;

  for (const blob of chatMedia.values()) {
    totalMediaBytes += blob.size || 0;
  }

  for (const [id, state] of chatRooms.entries()) {
    const msgCount = state.messages ? state.messages.length : 0;
    const burnedCount = state.messages ? state.messages.filter((m: EncryptedChatMessage) => m.isBurned).length : 0;
    const memberCount = state.members ? state.members.length : 0;

    totalMessages += msgCount;
    totalBurnedMessages += burnedCount;
    totalMembers += memberCount;

    rooms.push({
      id,
      createdAt: state.metadata.createdAt,
      expiresAt: state.metadata.expiresAt,
      ttlSeconds: state.metadata.ttlSeconds,
      hostPeerId: state.metadata.hostPeerId,
      memberCount,
      messageCount: msgCount,
      burnedCount,
      burnOnEmpty: state.metadata.burnOnEmpty,
      isDestroyed: state.metadata.isDestroyed,
      members: state.members
        ? state.members.map((m: ChatMember) => ({
            id: m.id,
            codename: m.codename,
            displayName: m.displayName,
            email: m.email,
            isHost: m.isHost,
            lastPing: m.lastPing,
          }))
        : [],
    });
  }

  return {
    activeChatRoomCount: chatRooms.size,
    totalMessages,
    totalBurnedMessages,
    totalMediaBlobs: chatMedia.size,
    totalMediaBytes,
    totalMembers,
    rooms,
  };
}

