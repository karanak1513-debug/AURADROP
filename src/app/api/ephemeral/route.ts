import { NextRequest, NextResponse } from 'next/server';
import { createPod, getPodState, purgePod } from '@/lib/storage';
import { PodConfig, PodTTL } from '@/types/vault';

export const dynamic = 'force-dynamic';

const TTL_MAP: Record<PodTTL, number> = {
  '15m': 15 * 60,
  '1h': 60 * 60,
  '6h': 6 * 60 * 60,
  '24h': 24 * 60 * 60,
  'never': 0,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      salt,
      ttl = '1h',
      burnOnDownload = false,
      burnOnEmpty = false,
      readOnlyGuests = false,
      creatorPeerId,
    } = body;

    if (!id || !salt) {
      return NextResponse.json(
        { error: 'Missing required parameters: id, salt' },
        { status: 400 }
      );
    }

    const ttlKey = (ttl as PodTTL) in TTL_MAP ? (ttl as PodTTL) : '1h';
    const ttlSeconds = TTL_MAP[ttlKey];

    const config: PodConfig = {
      id: id.trim().toUpperCase(),
      salt,
      ttl: ttlKey,
      ttlSeconds,
      burnOnDownload: Boolean(burnOnDownload),
      burnOnEmpty: Boolean(burnOnEmpty),
      readOnlyGuests: Boolean(readOnlyGuests),
      creatorPeerId: creatorPeerId || `peer-${Date.now().toString(36)}`,
    };

    const metadata = await createPod(config);

    return NextResponse.json({
      success: true,
      metadata,
    });
  } catch (err) {
    console.error('[API /api/ephemeral POST] Error:', err);
    return NextResponse.json(
      { error: 'Failed to provision ephemeral pod' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing room id' }, { status: 400 });
  }

  const state = await getPodState(id.toUpperCase());
  if (!state || state.metadata.isZeroized) {
    return NextResponse.json({ error: 'Room expired or zeroized' }, { status: 404 });
  }

  return NextResponse.json({ success: true, state });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing room id' }, { status: 400 });
  }

  await purgePod(id.toUpperCase(), 'EMERGENCY_NUKE_PURGE');
  return NextResponse.json({ success: true, message: 'Room memory zeroized' });
}
