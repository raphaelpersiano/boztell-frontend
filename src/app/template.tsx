'use client';

import { ReactNode } from 'react';

export default function Template({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}