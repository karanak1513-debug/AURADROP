import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveAnnouncements,
  broadcastAnnouncement,
  revokeAnnouncement,
  clearAllAnnouncements,
  getSubscriberCount,
  AnnouncementType,
  AnnouncementPriority,
} from '@/lib/announcementStore';

export const dynamic = 'force-dynamic';

// GET /api/announcements — List all active live announcements
export async function GET() {
  const list = getActiveAnnouncements();
  return NextResponse.json({
    success: true,
    count: list.length,
    announcements: list,
    activeSubscribers: getSubscriberCount(),
  });
}

// POST /api/announcements — Broadcast a new announcement live in real time
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, message, type, priority, expiresInMinutes, soundAlert, broadcastBy } = body;

    if (!title || !message) {
      return NextResponse.json(
        { success: false, error: 'Title and message are required' },
        { status: 400 }
      );
    }

    const created = broadcastAnnouncement({
      title,
      message,
      type: type as AnnouncementType,
      priority: priority as AnnouncementPriority,
      expiresInMinutes: typeof expiresInMinutes === 'number' ? expiresInMinutes : 0,
      soundAlert: soundAlert !== false,
      broadcastBy: broadcastBy || 'AuraDrop Command Center',
    });

    return NextResponse.json({
      success: true,
      announcement: created,
      activeSubscribers: getSubscriberCount(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/announcements — Revoke an announcement or clear all
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const clearAll = url.searchParams.get('all') === 'true';

    if (clearAll) {
      clearAllAnnouncements();
      return NextResponse.json({ success: true, message: 'All announcements cleared' });
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Announcement ID required' }, { status: 400 });
    }

    const removed = revokeAnnouncement(id);
    return NextResponse.json({ success: true, removed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
