import { NextRequest } from 'next/server';
import { getChatRoom, subscribeChatRoom, joinRoom, pingMember, ChatMember } from '@/lib/chatStore';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const roomId = id.toUpperCase();
  const url = new URL(req.url);
  const memberId = url.searchParams.get('memberId') || '';

  const room = await getChatRoom(roomId);
  if (!room) {
    return new Response('Room not found', { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: { type: string; payload: unknown }) => {
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch { /* closed */ }
      };

      // Send initial state immediately
      send({
        type: 'initial_state',
        payload: {
          metadata: room.metadata,
          members: room.members,
          messages: room.messages.slice(-100),
        },
      });

      // Subscribe to room events
      const unsubscribe = subscribeChatRoom(roomId, send);

      // Ping member alive
      if (memberId) {
        pingMember(roomId, memberId, false).catch(() => {});
      }

      // Keepalive heartbeat every 25s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
          if (memberId) {
            pingMember(roomId, memberId, false).catch(() => {});
          }
        } catch { clearInterval(heartbeat); }
      }, 25_000);

      // Cleanup on disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
