import { NextRequest, NextResponse } from 'next/server';
import { getChatRoom, storeMediaBlob, getMediaBlob } from '@/lib/chatStore';

export const dynamic = 'force-dynamic';

// Max 25 MB per upload
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// POST /api/rooms/[id]/media — Upload encrypted media blob
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const roomId = id.toUpperCase();

  try {
    const room = await getChatRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Room not found or expired' }, { status: 404 });
    }

    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File too large (max 25 MB)' }, { status: 413 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const mediaId = formData.get('mediaId') as string | null;
    const uploadedBy = formData.get('uploadedBy') as string | null;

    if (!file || !mediaId || !uploadedBy) {
      return NextResponse.json({ error: 'Missing file, mediaId, or uploadedBy' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File too large (max 25 MB)' }, { status: 413 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await storeMediaBlob({
      mediaId,
      roomId,
      encryptedBuffer: buffer,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      uploadedAt: Date.now(),
      uploadedBy,
    });

    return NextResponse.json({ success: true, mediaId, size: file.size });
  } catch (err) {
    console.error('[API /api/rooms/[id]/media POST]', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

// GET /api/rooms/[id]/media?mediaId=xxx — Download encrypted blob
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const roomId = id.toUpperCase();
  const url = new URL(req.url);
  const mediaId = url.searchParams.get('mediaId');

  if (!mediaId) {
    return NextResponse.json({ error: 'Missing mediaId' }, { status: 400 });
  }

  const blob = await getMediaBlob(mediaId);
  if (!blob || blob.roomId !== roomId) {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 });
  }

  return new Response(new Uint8Array(blob.encryptedBuffer), {
    headers: {
      'Content-Type': blob.mimeType,
      'Content-Length': String(blob.size),
      'Cache-Control': 'no-store',
      'X-Encrypted': 'true',
    },
  });
}
