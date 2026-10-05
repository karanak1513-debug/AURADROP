import { NextRequest, NextResponse } from 'next/server';
import {
  relayMessage,
  deleteMessage,
  addReaction,
  pingMember,
  leaveRoom,
  broadcastChat,
  markMessagesRead,
  triggerMessageBurn,
  burnMessage,
  EncryptedChatMessage,
} from '@/lib/chatStore';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const roomId = id.toUpperCase();

  try {
    const body = await req.json();
    const { eventType, payload } = body;

    switch (eventType) {
      case 'send_message': {
        const msg = payload as EncryptedChatMessage;
        const ok = await relayMessage(roomId, msg);
        if (!ok) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        return NextResponse.json({ success: true });
      }

      case 'mark_read': {
        const { messageIds, memberId } = payload as { messageIds: string[]; memberId: string };
        const result = await markMessagesRead(roomId, messageIds || [], memberId);
        return NextResponse.json({ success: true, ...result });
      }

      case 'trigger_burn': {
        const { messageId, memberId } = payload as { messageId: string; memberId: string };
        const ok = await triggerMessageBurn(roomId, messageId, memberId);
        return NextResponse.json({ success: ok });
      }

      case 'burn_now': {
        const { messageId, reason } = payload as { messageId: string; reason?: string };
        const ok = await burnMessage(roomId, messageId, reason || 'MANUAL_VIEW_ONCE_PURGE');
        return NextResponse.json({ success: ok });
      }

      case 'delete_message': {
        const { messageId, requesterId } = payload as { messageId: string; requesterId: string };
        const ok = await deleteMessage(roomId, messageId, requesterId);
        return NextResponse.json({ success: ok });
      }

      case 'react': {
        const { messageId, emoji, memberId } = payload as {
          messageId: string;
          emoji: string;
          memberId: string;
        };
        const ok = await addReaction(roomId, messageId, emoji, memberId);
        return NextResponse.json({ success: ok });
      }

      case 'ping': {
        const { memberId, isTyping } = payload as { memberId: string; isTyping: boolean };
        await pingMember(roomId, memberId, isTyping ?? false);
        return NextResponse.json({ success: true });
      }

      case 'leave': {
        const { memberId } = payload as { memberId: string };
        await leaveRoom(roomId, memberId);
        return NextResponse.json({ success: true });
      }

      case 'screen_capture_alert': {
        const { memberId, codename, timestamp } = payload as {
          memberId: string;
          codename: string;
          timestamp?: number;
        };
        broadcastChat(roomId, {
          type: 'screen_capture_alert',
          payload: {
            memberId,
            codename,
            timestamp: timestamp || Date.now(),
          },
        });
        return NextResponse.json({ success: true });
      }

      case 'broadcast': {
        // Generic event broadcast (e.g. custom signals)
        broadcastChat(roomId, { type: payload.type, payload: payload.data });
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Unknown event type' }, { status: 400 });
    }
  } catch (err) {
    console.error('[API /api/rooms/[id]/events POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
