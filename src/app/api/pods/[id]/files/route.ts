import { NextRequest, NextResponse } from 'next/server';
import { addFile, getPodState } from '@/lib/storage';
import { VaultFileMetadata } from '@/types/vault';

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
      return NextResponse.json({ error: 'POD_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      files: state.files,
    });
  } catch (err) {
    console.error('[API /api/pods/[id]/files GET] Error:', err);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const podId = id.toUpperCase();
    const state = await getPodState(podId);

    if (!state || state.metadata.isZeroized) {
      return NextResponse.json({ error: 'POD_NOT_ACTIVE' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const name = (formData.get('name') as string) || 'encrypted.bin';
    const size = parseInt((formData.get('size') as string) || '0', 10);
    const mimeType = (formData.get('mimeType') as string) || 'application/octet-stream';
    const sha256 = (formData.get('sha256') as string) || '';
    const uploadedBy = (formData.get('uploadedBy') as string) || 'OPERATOR';
    const burnOnDownload = formData.get('burnOnDownload') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided in request' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileId = `file-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    const metadata: VaultFileMetadata = {
      id: fileId,
      name,
      size: size || buffer.byteLength,
      mimeType,
      sha256,
      uploadedAt: Date.now(),
      uploadedBy,
      downloadCount: 0,
      burnOnDownload,
    };

    const added = await addFile(podId, metadata, buffer);
    if (!added) {
      return NextResponse.json({ error: 'Failed to store encrypted file' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      file: metadata,
    });
  } catch (err) {
    console.error('[API /api/pods/[id]/files POST] Error:', err);
    return NextResponse.json({ error: 'File upload processing failed' }, { status: 500 });
  }
}
