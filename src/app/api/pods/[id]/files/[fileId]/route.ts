import { NextRequest, NextResponse } from 'next/server';
import { getFileData, recordDownload, shredFile, getPodState } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const { id, fileId } = await context.params;
    const podId = id.toUpperCase();
    const { searchParams } = new URL(req.url);
    const peerCodename = searchParams.get('peerCodename') || 'ANONYMOUS';

    const state = await getPodState(podId);
    if (!state || state.metadata.isZeroized) {
      return NextResponse.json({ error: 'POD_NOT_ACTIVE' }, { status: 404 });
    }

    const stored = await getFileData(fileId);
    if (!stored) {
      return NextResponse.json({ error: 'FILE_NOT_FOUND_OR_SHREDDED' }, { status: 404 });
    }

    // Trigger download record & potential burn
    await recordDownload(podId, fileId, peerCodename);

    // Return the encrypted file buffer
    return new Response(new Uint8Array(stored.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': stored.buffer.byteLength.toString(),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(stored.metadata.name)}.enc"`,
        'X-Encrypted-SHA256': stored.metadata.sha256,
      },
    });
  } catch (err) {
    console.error('[API /api/pods/[id]/files/[fileId] GET] Error:', err);
    return NextResponse.json({ error: 'Failed to retrieve file' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const { id, fileId } = await context.params;
    const podId = id.toUpperCase();

    const success = await shredFile(podId, fileId, 'USER_MANUAL_SHRED');
    return NextResponse.json({
      success,
      fileId,
      message: 'File buffer successfully zeroized and shredded from memory.',
    });
  } catch (err) {
    console.error('[API /api/pods/[id]/files/[fileId] DELETE] Error:', err);
    return NextResponse.json({ error: 'Failed to shred file' }, { status: 500 });
  }
}
