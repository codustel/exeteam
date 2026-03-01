'use client';

import { type ReactNode } from 'react';

export function ResponsiveTableWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto -mx-4 sm:mx-0">
      <div className="min-w-[640px] sm:min-w-0 px-4 sm:px-0">
        {children}
      </div>
    </div>
  );
}
