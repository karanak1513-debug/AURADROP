import { NextRequest, NextResponse } from 'next/server';
import { getPodState, updateLinkBundle, recordLinkClick } from '@/lib/storage';
import { LinkBundleProfile } from '@/types/vault';

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
        { error: 'POD_NOT_FOUND_OR_EXPIRED', message: 'This Linktree pod does not exist or has expired.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      podId,
      linkBundle: state.linkBundle || null,
      metadata: state.metadata,
    });
  } catch (err) {
    console.error('[API /api/pods/[id]/links GET] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch link bundle' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const podId = id.toUpperCase();
    const body = await req.json();

    const bundle: LinkBundleProfile = body.bundle || body;
    const peerCodename = body.peerCodename || 'Curator';

    if (!bundle || !Array.isArray(bundle.links)) {
      return NextResponse.json({ error: 'Invalid link bundle payload' }, { status: 400 });
    }

    const success = await updateLinkBundle(podId, bundle, peerCodename);
    if (!success) {
      return NextResponse.json({ error: 'Pod not found or zeroized' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      podId,
      linkBundle: bundle,
    });
  } catch (err) {
    console.error('[API /api/pods/[id]/links POST] Error:', err);
    return NextResponse.json({ error: 'Failed to update link bundle' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const podId = id.toUpperCase();
    const body = await req.json();
    const linkId = body.linkId;

    if (!linkId) {
      return NextResponse.json({ error: 'Missing linkId' }, { status: 400 });
    }

    const success = await recordLinkClick(podId, linkId);
    return NextResponse.json({ success });
  } catch (err) {
    console.error('[API /api/pods/[id]/links PATCH] Error:', err);
    return NextResponse.json({ error: 'Failed to record link click' }, { status: 500 });
  }
}
