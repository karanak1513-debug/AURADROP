'use client';

import SecretDropModulePage from '@/app/drop/[id]/page';

export default function PodWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  return <SecretDropModulePage params={params} />;
}
