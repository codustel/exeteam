'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, FolderKanban, CheckSquare, MapPin, Users, Building2,
  Package, FileText, Receipt, Euro, MessageSquare, Clock,
  Upload, Settings, BarChart3, CalendarDays, ChevronLeft, ChevronRight,
  FileCheck, TrendingUp, Factory, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/button';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

type NavEntry = NavItem | { group: NavGroup };

const navEntries: NavEntry[] = [
  { label: 'Projets', href: '/projects', icon: FolderKanban },
  { label: 'Tâches', href: '/tasks', icon: CheckSquare },
  { label: 'Pointage', href: '/timesheets', icon: Clock },
  { label: 'Sites', href: '/sites', icon: MapPin },
  { label: 'Clients', href: '/clients', icon: Building2 },
  { label: 'Codes produits', href: '/products', icon: Package },
  { label: 'Bordereaux', href: '/commercial/attachments', icon: FileText },
  { label: 'Devis', href: '/commercial/quotes', icon: FileCheck },
  { label: 'Factures', href: '/commercial/invoices', icon: Euro },
  { label: 'Comptabilité', href: '/accounting', icon: Euro },
  { label: 'Employés', href: '/employees', icon: Users },
  { label: 'Congés', href: '/leaves', icon: CalendarDays },
  { label: 'Demandes', href: '/demands', icon: Receipt },
  { label: 'Messagerie', href: '/messages', icon: MessageSquare },
  { label: 'Import', href: '/import', icon: Upload },
  {
    group: {
      label: 'Tableaux de bord',
      icon: BarChart3,
      items: [
        { label: 'Général', href: '/dashboards', icon: LayoutDashboard, exact: true },
        { label: 'Production', href: '/dashboards/production', icon: Factory },
        { label: 'Financier', href: '/dashboards/financier', icon: Euro },
        { label: 'Rentabilité', href: '/dashboards/rentabilite', icon: TrendingUp },
      ],
    },
  },
  { label: 'Administration', href: '/admin', icon: Settings },
];

function isNavItem(entry: NavEntry): entry is NavItem {
  return 'href' in entry;
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [dashboardsOpen, setDashboardsOpen] = useState(
    pathname.startsWith('/dashboards'),
  );

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-card border-r border-border transition-all duration-200',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          ET
        </div>
        {!collapsed && (
          <span className="font-bold text-lg text-foreground">ExeTeam</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
        {navEntries.map((entry) => {
          if (isNavItem(entry)) {
            const Icon = entry.icon;
            const isActive = entry.exact
              ? pathname === entry.href
              : pathname.startsWith(entry.href);
            return (
              <Link
                key={entry.href}
                href={entry.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span>{entry.label}</span>}
              </Link>
            );
          }

          // Group
          const group = entry.group;
          const GroupIcon = group.icon;
          const groupActive = group.items.some((item) =>
            item.exact ? pathname === item.href : pathname.startsWith(item.href),
          );

          return (
            <div key={group.label}>
              <button
                type="button"
                onClick={() => !collapsed && setDashboardsOpen((o) => !o)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  groupActive
                    ? 'text-[#FF6600] bg-orange-50'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <GroupIcon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{group.label}</span>
                    {dashboardsOpen ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </>
                )}
              </button>

              {!collapsed && dashboardsOpen && (
                <div className="ml-3 mt-1 space-y-0.5 border-l border-border pl-3">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = item.exact
                      ? pathname === item.href
                      : pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                          isActive
                            ? 'text-[#FF6600] font-semibold'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                        )}
                      >
                        <ItemIcon className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Collapse button */}
      <div className="p-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
