import React from 'react';
import { cn } from '../lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface StatItem {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
}

interface StatsBarProps {
  stats: StatItem[];
  className?: string;
}

export function StatsBar({ stats, className }: StatsBarProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 sm:grid-cols-4 p-4 bg-card rounded-lg border border-border',
        className,
      )}
    >
      {stats.map((stat, i) => (
        <div key={i} className={cn('flex flex-col gap-1', stat.className)}>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {stat.label}
          </span>
          <span className="text-2xl font-bold text-foreground">{stat.value}</span>
          {stat.trendValue && (
            <span
              className={cn('text-xs', {
                'text-green-500': stat.trend === 'up',
                'text-red-500': stat.trend === 'down',
                'text-muted-foreground': stat.trend === 'neutral',
              })}
            >
              {stat.trendValue}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
