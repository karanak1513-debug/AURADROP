import { NextRequest, NextResponse } from 'next/server';
import {
  getPodState,
  updateScratchpad,
  addOrUpdatePeer,
  broadcast,
  updateLinkBundle,
  recordLinkClick,
} from '@/lib/storage';
import { Peer, ScratchpadData, TacticalMessage, LinkBundleProfile } from '@/types/vault';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const podId = id.toUpperCase();
    const body = await req.json();
    const { eventType, payload } = body;

    const state = await getPodState(podId);
    if (!state || state.metadata.isZeroized) {
      return NextResponse.json(
        { error: 'POD_NOT_ACTIVE' },
        { status: 404 }
      );
    }

    switch (eventType) {
      case 'scratchpad_update': {
        const scratchpad = payload as ScratchpadData;
        const success = await updateScratchpad(podId, scratchpad);
        return NextResponse.json({ success });
      }

      case 'cursor_update': {
        const { peerId, line, col } = payload;
        broadcast(podId, {
          type: 'cursor_update',
          payload: { peerId, line, col },
        });
        return NextResponse.json({ success: true });
      }

      case 'peer_ping': {
        const peer = payload as Peer;
        await addOrUpdatePeer(podId, peer);
        return NextResponse.json({ success: true });
      }

      case 'tactical_message': {
        const message = payload as TacticalMessage;
        broadcast(podId, {
          type: 'tactical_message',
          payload: message,
        });
        return NextResponse.json({ success: true });
      }

      case 'link_bundle_updated': {
        const { bundle, peerCodename } = payload;
        const success = await updateLinkBundle(podId, bundle as LinkBundleProfile, peerCodename);
        return NextResponse.json({ success });
      }

      case 'link_clicked': {
        const { linkId } = payload;
        const success = await recordLinkClick(podId, linkId);
        return NextResponse.json({ success });
      }

      default:
        return NextResponse.json(
          { error: `Unknown event type: ${eventType}` },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error('[API /api/pods/[id]/events] Error:', err);
    return NextResponse.json(
      { error: 'Failed to process event' },
      { status: 500 }
    );
  }
}
