// Real-Time Live Announcement & Notification Hub for AuraDrop

export type AnnouncementType = 'info' | 'warning' | 'alert' | 'success' | 'emergency';
export type AnnouncementPriority = 'low' | 'normal' | 'urgent';

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: AnnouncementType;
  priority: AnnouncementPriority;
  createdAt: number;
  expiresAt: number; // 0 for persistent until manually revoked
  soundAlert: boolean;
  broadcastBy: string;
  active: boolean;
}

type AnnouncementListener = (event: {
  type: 'announcement_created' | 'announcement_revoked' | 'announcements_cleared' | 'initial';
  announcement?: Announcement;
  announcements?: Announcement[];
  revokedId?: string;
}) => void;

// In-memory store
const announcements = new Map<string, Announcement>();
const listeners = new Set<AnnouncementListener>();

// Cleanup expired announcements periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [id, ann] of announcements.entries()) {
      if (ann.expiresAt > 0 && ann.expiresAt <= now) {
        announcements.delete(id);
        notifyListeners({ type: 'announcement_revoked', revokedId: id });
      }
    }
  }, 10_000);
}

function notifyListeners(event: {
  type: 'announcement_created' | 'announcement_revoked' | 'announcements_cleared' | 'initial';
  announcement?: Announcement;
  announcements?: Announcement[];
  revokedId?: string;
}) {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      listeners.delete(listener);
    }
  }
}

export function subscribeAnnouncements(listener: AnnouncementListener): () => void {
  listeners.add(listener);
  // Send active announcements immediately on connect
  const active = getActiveAnnouncements();
  try {
    listener({ type: 'initial', announcements: active });
  } catch {
    listeners.delete(listener);
  }
  return () => {
    listeners.delete(listener);
  };
}

export function getActiveAnnouncements(): Announcement[] {
  const now = Date.now();
  const list: Announcement[] = [];
  for (const [id, ann] of announcements.entries()) {
    if (ann.active && (ann.expiresAt === 0 || ann.expiresAt > now)) {
      list.push(ann);
    } else if (ann.expiresAt > 0 && ann.expiresAt <= now) {
      announcements.delete(id);
    }
  }
  // Sort newest first, then urgent priority first
  return list.sort((a, b) => {
    if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
    if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
    return b.createdAt - a.createdAt;
  });
}

export function broadcastAnnouncement(params: {
  title: string;
  message: string;
  type?: AnnouncementType;
  priority?: AnnouncementPriority;
  expiresInMinutes?: number;
  soundAlert?: boolean;
  broadcastBy?: string;
}): Announcement {
  const id = `ann_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();
  const durationMs = params.expiresInMinutes && params.expiresInMinutes > 0
    ? params.expiresInMinutes * 60 * 1000
    : 0;

  const announcement: Announcement = {
    id,
    title: params.title.trim(),
    message: params.message.trim(),
    type: params.type || 'info',
    priority: params.priority || 'normal',
    createdAt: now,
    expiresAt: durationMs > 0 ? now + durationMs : 0,
    soundAlert: params.soundAlert ?? true,
    broadcastBy: params.broadcastBy || 'SYSTEM ADMIN',
    active: true,
  };

  announcements.set(id, announcement);
  notifyListeners({ type: 'announcement_created', announcement });
  return announcement;
}

export function revokeAnnouncement(id: string): boolean {
  if (announcements.has(id)) {
    announcements.delete(id);
    notifyListeners({ type: 'announcement_revoked', revokedId: id });
    return true;
  }
  return false;
}

export function clearAllAnnouncements(): void {
  announcements.clear();
  notifyListeners({ type: 'announcements_cleared' });
}

export function getSubscriberCount(): number {
  return listeners.size;
}
