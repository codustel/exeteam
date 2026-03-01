'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Factory, Euro, TrendingUp } from 'lucide-react';

const dashboardLinks = [
  { href: '/dashboards', label: 'Général', icon: LayoutDashboard, exact: true },
  { href: '/dashboards/production', label: 'Production', icon: Factory, exact: false },
  { href: '/dashboards/financier', label: 'Financier', icon: Euro, exact: false },
  { href: '/dashboards/rentabilite', label: 'Rentabilité', icon: TrendingUp, exact: false },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-background px-6">
        <nav className="flex gap-1">
          {dashboardLinks.map((link) => {
            const Icon = link.icon;
            const isActive = link.exact
              ? pathname === link.href
              : pathname.startsWith(link.href) && !link.exact;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  isActive
                    ? 'border-[#FF6600] text-[#FF6600]'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
