import { NextRequest, NextResponse } from 'next/server';
import { getPodState, purgePod } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const podId = id.toUpperCase();
    const state = await getPodState(podId);

    if (!state) {
      return NextResponse.json(
        { error: 'POD_NOT_FOUND_OR_EXPIRED', message: 'This ephemeral pod does not exist or has expired.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      pod: state,
      state,
    });
  } catch (err) {
    console.error('[API /api/pods/[id] GET] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error fetching pod' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const podId = id.toUpperCase();
    const { searchParams } = new URL(req.url);
    const reason = searchParams.get('reason') || 'EMERGENCY_MANUAL_ZEROIZE';

    const success = await purgePod(podId, reason);

    return NextResponse.json({
      success,
      zeroized: true,
      podId,
      message: 'Pod and all associated ephemeral memory buffers have been permanently zeroized.',
    });
  } catch (err) {
    console.error('[API /api/pods/[id] DELETE] Error:', err);
    return NextResponse.json(
      { error: 'Failed to execute zeroize command' },
      { status: 500 }
    );
  }
}
