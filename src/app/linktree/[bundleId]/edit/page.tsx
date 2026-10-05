'use client';

import React, { use } from 'react';
import SmartLinktreeModulePage from '@/app/links/[id]/page';

export default function LinktreeCreatorStudioPage({
  params,
}: {
  params: Promise<{ bundleId: string }>;
}) {
  const resolved = use(params);
  return <SmartLinktreeModulePage params={Promise.resolve({ id: resolved.bundleId })} />;
}
