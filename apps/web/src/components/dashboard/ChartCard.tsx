'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function ChartCard({
  title,
  children,
  action,
  className,
  contentClassName,
}: ChartCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {action && <div>{action}</div>}
      </CardHeader>
      <CardContent className={cn('', contentClassName)}>{children}</CardContent>
    </Card>
  );
}
