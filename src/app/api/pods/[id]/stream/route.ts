import { NextRequest } from 'next/server';
import { getPodState, subscribePod, removePeer } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const podId = id.toUpperCase();
  const { searchParams } = new URL(req.url);
  const peerId = searchParams.get('peerId') || '';

  const state = await getPodState(podId);
  if (!state) {
    return new Response(JSON.stringify({ error: 'POD_NOT_FOUND' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Initial State Handshake
      const initPayload = JSON.stringify({
        type: 'initial_state',
        payload: state,
      });
      controller.enqueue(encoder.encode(`data: ${initPayload}\n\n`));

      // 2. Subscribe to real-time events
      const unsubscribe = subscribePod(podId, (event) => {
        try {
          const serialized = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${serialized}\n\n`));
        } catch (err) {
          console.error('[SSE stream controller error]', err);
        }
      });

      // 3. Heartbeat keepalive every 15s
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 15_000);

      // 4. Handle client disconnection
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        unsubscribe();
        if (peerId) {
          removePeer(podId, peerId).catch(() => {});
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Nginx buffering disable
    },
  });
}
