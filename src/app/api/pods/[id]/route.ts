import { NextRequest, NextResponse } from 'next/server';
import { getPodState, purgePod, createPod } from '@/lib/storage';
import { generateDeterministicSalt } from '@/lib/crypto';
import { getChatRoom } from '@/lib/chatStore';
import { PodMetadata } from '@/types/vault';

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
      // Check if room exists in chatStore
      const room = await getChatRoom(podId);
      if (room) {
        const mockMeta: PodMetadata = {
          id: podId,
          salt: room.metadata.salt,
          createdAt: room.metadata.createdAt,
          expiresAt: room.metadata.expiresAt,
          ttlSeconds: room.metadata.ttlSeconds,
          burnOnDownload: false,
          burnOnEmpty: false,
          readOnlyGuests: false,
          creatorPeerId: room.metadata.hostPeerId,
          isZeroized: false,
        };
        const defaultStarterBundle = {
          title: `${podId} Link Hub`,
          bio: 'Self-destructing links. Private, zero-log & client-side encrypted.',
          themeColor: '#6366F1',
          qrColor: '#0F172A',
          links: [
            {
              id: 'link-demo-1',
              title: 'Project Documentation & Assets',
              url: 'https://auradrop.io',
              category: 'website' as const,
              description: 'Main documentation and project specs.',
              tag: 'DOCS',
              clicks: 0,
              addedBy: room.metadata.hostPeerId || 'Host',
              addedAt: Date.now() - 60000,
            },
            {
              id: 'link-demo-2',
              title: 'GitHub Source Repository',
              url: 'https://github.com/karanak1513-debug/AURADROP',
              category: 'github' as const,
              description: 'Source code commits and issues.',
              tag: 'CODE',
              clicks: 0,
              addedBy: room.metadata.hostPeerId || 'Host',
              addedAt: Date.now() - 30000,
            },
          ],
        };
        return NextResponse.json({
          success: true,
          pod: { metadata: mockMeta, linkBundle: defaultStarterBundle },
          state: { metadata: mockMeta, linkBundle: defaultStarterBundle },
        });
      }

      // Auto-provision pod state for QR scans and shared links so mobile users never encounter 404
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
        { error: 'POD_NOT_FOUND_OR_EXPIRED', message: 'This ephemeral pod does not exist or has expired.' },
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
      pod: state,
      state,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[API /api/pods/[id] GET] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error fetching pod', details: errorMsg },
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
