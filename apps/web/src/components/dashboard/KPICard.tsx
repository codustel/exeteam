'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  label: string;
  value: string | number;
  trend?: number;
  trendLabel?: string;
  className?: string;
  valueClassName?: string;
}

export function KPICard({
  label,
  value,
  trend,
  trendLabel,
  className,
  valueClassName,
}: KPICardProps) {
  const hasTrend = trend !== undefined;
  const isUp = (trend ?? 0) > 0;
  const isDown = (trend ?? 0) < 0;

  return (
    <Card className={cn('', className)}>
      <CardContent className="pt-5 pb-4 px-5">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <p className={cn('text-2xl font-bold mt-1', valueClassName)}>{value}</p>
        {hasTrend && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs mt-2',
              isUp && 'text-green-600',
              isDown && 'text-red-500',
              !isUp && !isDown && 'text-muted-foreground',
            )}
          >
            {isUp && <TrendingUp className="h-3 w-3" />}
            {isDown && <TrendingDown className="h-3 w-3" />}
            {!isUp && !isDown && <Minus className="h-3 w-3" />}
            <span>
              {isUp ? '+' : ''}
              {trend?.toFixed(1)}%{trendLabel ? ` ${trendLabel}` : ''}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
