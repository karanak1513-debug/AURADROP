import { NextRequest, NextResponse } from 'next/server';
import {
  getChatRoom,
  destroyRoom,
  joinRoom,
  ChatMember,
} from '@/lib/chatStore';

export const dynamic = 'force-dynamic';

// GET /api/rooms/[id] — Fetch room state
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const roomId = id.toUpperCase();

  const room = await getChatRoom(roomId);
  if (!room) {
    return NextResponse.json({ error: 'Room not found or expired' }, { status: 404 });
  }

  // Return safe public state (messages are encrypted — relay as-is)
  return NextResponse.json({ success: true, room });
}

// DELETE /api/rooms/[id] — Host destroys room
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const roomId = id.toUpperCase();
  const reason = new URL(req.url).searchParams.get('reason') || 'HOST_MANUAL_PURGE';

  await destroyRoom(roomId, reason);
  return NextResponse.json({ success: true, destroyed: true });
}

// POST /api/rooms/[id] — Join room
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const roomId = id.toUpperCase();

  try {
    const body = await req.json();
    const { member } = body as { member: ChatMember };

    if (!member || !member.id || !member.codename) {
      return NextResponse.json({ error: 'Invalid member payload' }, { status: 400 });
    }

    const room = await joinRoom(roomId, member);
    if (!room) {
      return NextResponse.json({ error: 'Room not found or expired' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      metadata: room.metadata,
      members: room.members,
      messages: room.messages.slice(-100), // Last 100 messages on join
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg === 'ROOM_FULL') {
      return NextResponse.json({ error: 'Room is full' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to join room' }, { status: 500 });
  }
}
