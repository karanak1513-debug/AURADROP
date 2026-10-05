import { NextRequest, NextResponse } from 'next/server';
import { createChatRoom, ChatRoomTTL } from '@/lib/chatStore';

export const dynamic = 'force-dynamic';

const VALID_TTLS: ChatRoomTTL[] = ['15m', '1h', '6h', '24h'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      salt,
      ttl = '1h',
      hostPeerId,
      maxMembers = 50,
      burnOnEmpty = false,
    } = body;

    if (!id || !salt || !hostPeerId) {
      return NextResponse.json(
        { error: 'Missing required parameters: id, salt, hostPeerId' },
        { status: 400 }
      );
    }

    const ttlKey = VALID_TTLS.includes(ttl) ? ttl : '1h';

    const metadata = await createChatRoom({
      id: id.trim().toUpperCase(),
      salt,
      ttl: ttlKey,
      hostPeerId,
      maxMembers: Math.min(Number(maxMembers) || 50, 200),
      burnOnEmpty: Boolean(burnOnEmpty),
    });

    return NextResponse.json({ success: true, metadata });
  } catch (err) {
    console.error('[API /api/rooms POST]', err);
    return NextResponse.json({ error: 'Failed to create chat room' }, { status: 500 });
  }
}
