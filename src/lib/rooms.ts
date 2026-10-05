import { db } from "@/lib/firestore";
import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";

export interface FirestoreChatRoom {
  roomId: string;
  passHash?: string;
  salt?: string;
  createdAt: number;
  expiresAt: number;
  hostEmail: string;
  hostPeerId?: string;
  status: 'ACTIVE' | 'PURGED' | 'EXPIRED';
  ttlHours?: number;
  title?: string;
  updatedAt?: number;
}

export interface FirestoreLinktreeBundle {
  bundleId: string;
  title: string;
  links: any[];
  theme: string;
  createdAt: number;
  expiresAt: number;
  hostEmail: string;
  status: 'ACTIVE' | 'PURGED' | 'EXPIRED';
  bio?: string;
  customName?: string;
  avatarIcon?: string;
  themeColor?: string;
  qrColor?: string;
  updatedAt?: number;
}

// 1. SAVE CHAT ROOM ON CREATION
export async function createChatRoomRecord(
  roomId: string,
  passHash: string,
  ttlHours: number = 1,
  hostEmail?: string,
  extra: { salt?: string; hostPeerId?: string } = {}
): Promise<{ roomId: string; expiresAt: number }> {
  const normId = roomId.trim().toUpperCase();
  const roomRef = doc(db, "chat_rooms", normId);
  const expiresAt = ttlHours > 0 ? Date.now() + ttlHours * 60 * 60 * 1000 : 0;

  await setDoc(
    roomRef,
    {
      roomId: normId,
      passHash, // Derived PBKDF2 hash or password verification
      salt: extra.salt || '',
      hostPeerId: extra.hostPeerId || '',
      createdAt: Date.now(),
      expiresAt,
      ttlHours,
      hostEmail: hostEmail || "anonymous",
      status: "ACTIVE",
      updatedAt: Date.now(),
    },
    { merge: true }
  );

  return { roomId: normId, expiresAt };
}

// 2. SAVE LINKTREE BUNDLE ON CREATION / UPDATE
export async function saveLinktreeBundleRecord(
  bundleId: string,
  title: string,
  links: any[],
  theme: string = "indigo",
  ttlHours: number = 24,
  hostEmail?: string,
  extra: Record<string, any> = {}
): Promise<{ bundleId: string; expiresAt: number }> {
  const normId = bundleId.trim().toUpperCase();
  const bundleRef = doc(db, "linktree_bundles", normId);
  const expiresAt = ttlHours > 0 ? Date.now() + ttlHours * 60 * 60 * 1000 : 0;

  await setDoc(
    bundleRef,
    {
      bundleId: normId,
      title: title || `${normId} Link Hub`,
      links: links || [],
      theme: theme || "indigo",
      createdAt: Date.now(),
      expiresAt,
      ttlHours,
      hostEmail: hostEmail || "anonymous",
      status: "ACTIVE",
      updatedAt: Date.now(),
      ...extra,
    },
    { merge: true }
  );

  return { bundleId: normId, expiresAt };
}

// 3. GET CHAT ROOM RECORD
export async function getChatRoomRecord(roomId: string): Promise<FirestoreChatRoom | null> {
  try {
    const normId = roomId.trim().toUpperCase();
    const roomRef = doc(db, "chat_rooms", normId);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return null;
    return snap.data() as FirestoreChatRoom;
  } catch (err) {
    console.warn('[rooms.ts] getChatRoomRecord error:', err);
    return null;
  }
}

// 4. GET LINKTREE BUNDLE RECORD
export async function getLinktreeBundleRecord(bundleId: string): Promise<FirestoreLinktreeBundle | null> {
  try {
    const normId = bundleId.trim().toUpperCase();
    const bundleRef = doc(db, "linktree_bundles", normId);
    const snap = await getDoc(bundleRef);
    if (!snap.exists()) return null;
    return snap.data() as FirestoreLinktreeBundle;
  } catch (err) {
    console.warn('[rooms.ts] getLinktreeBundleRecord error:', err);
    return null;
  }
}

// 5. SUBSCRIBE TO CHAT ROOM
export function subscribeToChatRoom(
  roomId: string,
  onUpdate: (data: FirestoreChatRoom | null) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const normId = roomId.trim().toUpperCase();
  const roomRef = doc(db, "chat_rooms", normId);
  return onSnapshot(
    roomRef,
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
      } else {
        onUpdate(snap.data() as FirestoreChatRoom);
      }
    },
    (err) => {
      console.warn('[rooms.ts] subscribeToChatRoom error:', err);
      onError?.(err);
    }
  );
}

// 6. SUBSCRIBE TO LINKTREE BUNDLE
export function subscribeToLinktreeBundle(
  bundleId: string,
  onUpdate: (data: FirestoreLinktreeBundle | null) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const normId = bundleId.trim().toUpperCase();
  const bundleRef = doc(db, "linktree_bundles", normId);
  return onSnapshot(
    bundleRef,
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
      } else {
        onUpdate(snap.data() as FirestoreLinktreeBundle);
      }
    },
    (err) => {
      console.warn('[rooms.ts] subscribeToLinktreeBundle error:', err);
      onError?.(err);
    }
  );
}

// 7. PURGE CHAT ROOM RECORD
export async function purgeChatRoomRecord(roomId: string, reason: string = 'MANUAL_PURGE'): Promise<void> {
  try {
    const normId = roomId.trim().toUpperCase();
    const roomRef = doc(db, "chat_rooms", normId);
    await setDoc(roomRef, { status: 'PURGED', purgeReason: reason, purgedAt: Date.now() }, { merge: true });
  } catch (err) {
    console.warn('[rooms.ts] purgeChatRoomRecord error:', err);
  }
}
