'use client';

import React, { useState, useEffect, use } from 'react';
import SecretDropModulePage from '@/app/drop/[id]/page';
import RealtimeChatModulePage from '@/app/chat/[id]/page';
import SmartLinktreeModulePage from '@/app/links/[id]/page';

export default function RoomDispatcherPage({ params }: { params: Promise<{ id: string }> }) {
  const [targetModule, setTargetModule] = useState<'chat' | 'drop' | 'links'>('chat');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const mod = sp.get('module') || sp.get('tab');

    if (mod === 'drop' || mod === 'vault' || mod === 'files') {
      setTargetModule('drop');
    } else if (mod === 'links' || mod === 'linktree' || mod === 'qr') {
      setTargetModule('links');
    } else {
      setTargetModule('chat');
    }
  }, []);

  if (targetModule === 'drop') {
    return <SecretDropModulePage params={params} />;
  }

  if (targetModule === 'links') {
    return <SmartLinktreeModulePage params={params} />;
  }

  return <RealtimeChatModulePage params={params} />;
}
