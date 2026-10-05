import { NextRequest, NextResponse } from 'next/server';
import { addFileChunk, getPodState, createPod } from '@/lib/storage';
import { VaultFileMetadata } from '@/types/vault';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const podId = id.toUpperCase();
    let state = await getPodState(podId);

    if (!state || state.metadata.isZeroized) {
      if (!state) {
        // Auto-provision pod in current serverless container if cold-started
        await createPod({
          id: podId,
          salt: '00000000000000000000000000000000',
          ttl: '1h',
          ttlSeconds: 3600,
          burnOnDownload: false,
          burnOnEmpty: false,
          readOnlyGuests: false,
          creatorPeerId: 'OPERATOR',
        });
        state = await getPodState(podId);
      } else {
        return NextResponse.json(
          { error: 'This drop pod has been shredded or expired.' },
          { status: 410 }
        );
      }
    }

    const formData = await req.formData();
    const chunk = formData.get('chunk') as File | null;
    const fileId = formData.get('fileId') as string;
    const chunkIndex = parseInt((formData.get('chunkIndex') as string) || '0', 10);
    const totalChunks = parseInt((formData.get('totalChunks') as string) || '1', 10);
    const name = (formData.get('name') as string) || 'encrypted.bin';
    const size = parseInt((formData.get('size') as string) || '0', 10);
    const mimeType = (formData.get('mimeType') as string) || 'application/octet-stream';
    const sha256 = (formData.get('sha256') as string) || '';
    const uploadedBy = (formData.get('uploadedBy') as string) || 'OPERATOR';
    const burnOnDownload = formData.get('burnOnDownload') === 'true';

    if (!chunk || !fileId) {
      return NextResponse.json(
        { error: 'Missing chunk payload or fileId' },
        { status: 400 }
      );
    }

    const arrayBuffer = await chunk.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const metadata: VaultFileMetadata = {
      id: fileId,
      name,
      size,
      mimeType,
      sha256,
      uploadedAt: Date.now(),
      uploadedBy,
      downloadCount: 0,
      burnOnDownload,
    };

    const result = await addFileChunk(
      podId,
      metadata,
      chunkIndex,
      totalChunks,
      buffer
    );

    return NextResponse.json({
      success: true,
      complete: result.complete,
      file: result.file,
      chunkIndex,
      totalChunks,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[API /api/pods/[id]/files/chunk POST] Error:', err);
    return NextResponse.json(
      { error: 'Chunk upload failed', details: errorMsg },
      { status: 500 }
    );
  }
}
