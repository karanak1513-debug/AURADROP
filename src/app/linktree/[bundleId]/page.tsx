'use client';

import React from 'react';
import PublicLinktreeRecipientPage from '@/app/l/[bundleId]/page';

export default function LinktreeRecipientAliasPage({
  params,
}: {
  params: Promise<{ bundleId: string }>;
}) {
  return <PublicLinktreeRecipientPage params={params} />;
}
