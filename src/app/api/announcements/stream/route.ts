import { NextRequest } from 'next/server';
import { subscribeAnnouncements } from '@/lib/announcementStore';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: {
        type: string;
        announcement?: unknown;
        announcements?: unknown;
        revokedId?: string;
      }) => {
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          // Closed by client
        }
      };

      // Subscribe to live announcements
      const unsubscribe = subscribeAnnouncements((event) => {
        send(event);
      });

      // Keepalive heartbeat every 20 seconds
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 20_000);

      // Clean up on disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
