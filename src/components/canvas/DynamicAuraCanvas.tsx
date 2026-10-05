'use client';

import dynamic from 'next/dynamic';

export const DynamicAuraCanvas = dynamic(
  () => import('./AuraCanvas').then((mod) => mod.AuraCanvas),
  {
    ssr: false,
    loading: () => (
      <div
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
        style={{ opacity: 0.85 }}
      />
    ),
  }
);
