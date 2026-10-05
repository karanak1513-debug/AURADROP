import { NextRequest, NextResponse } from 'next/server';
import { getPodState, updateLinkBundle, recordLinkClick, createPod } from '@/lib/storage';
import { generateDeterministicSalt } from '@/lib/crypto';
import { LinkBundleProfile } from '@/types/vault';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const podId = id.toUpperCase();
    let state = await getPodState(podId);

    if (!state) {
      const defaultSalt = generateDeterministicSalt(podId);
      await createPod({
        id: podId,
        salt: defaultSalt,
        ttl: 'never',
        ttlSeconds: 0,
        burnOnDownload: false,
        burnOnEmpty: false,
        readOnlyGuests: false,
        creatorPeerId: 'OPERATOR',
      });
      state = await getPodState(podId);
    }

    if (!state) {
      return NextResponse.json(
        { error: 'POD_NOT_FOUND_OR_EXPIRED', message: 'This Linktree pod does not exist or has expired.' },
        { status: 404 }
      );
    }

    if (!state.linkBundle || !state.linkBundle.links || state.linkBundle.links.length === 0) {
      state.linkBundle = {
        title: state.linkBundle?.title || `${podId} Link Hub`,
        bio: state.linkBundle?.bio || 'Self-destructing links. Private, zero-log & client-side encrypted.',
        customName: state.linkBundle?.customName || 'Curated by AuraDrop',
        avatarIcon: state.linkBundle?.avatarIcon || 'monogram',
        themeColor: state.linkBundle?.themeColor || '#6366F1',
        qrColor: state.linkBundle?.qrColor || '#0F172A',
        links: [
          {
            id: 'link-demo-1',
            title: 'Project Documentation & Assets',
            url: 'https://auradrop.io',
            category: 'website',
            description: 'Main documentation and project specs.',
            tag: 'DOCS',
            clicks: 0,
            addedBy: 'AuraDrop',
            addedAt: Date.now() - 60000,
          },
          {
            id: 'link-demo-2',
            title: 'GitHub Source Repository',
            url: 'https://github.com/karanak1513-debug/AURADROP',
            category: 'github',
            description: 'Source code commits and issues.',
            tag: 'CODE',
            clicks: 0,
            addedBy: 'AuraDrop',
            addedAt: Date.now() - 30000,
          },
        ],
      };
    }

    return NextResponse.json({
      success: true,
      podId,
      linkBundle: state.linkBundle,
      metadata: state.metadata,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[API /api/pods/[id]/links GET] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch link bundle', details: errorMsg }, { status: 500 });
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

    let success = await updateLinkBundle(podId, bundle, peerCodename);
    if (!success) {
      await createPod({
        id: podId,
        salt: generateDeterministicSalt(podId),
        ttl: 'never',
        ttlSeconds: 0,
        burnOnDownload: false,
        burnOnEmpty: false,
        readOnlyGuests: false,
        creatorPeerId: peerCodename,
      });
      success = await updateLinkBundle(podId, bundle, peerCodename);
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
