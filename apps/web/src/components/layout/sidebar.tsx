'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, FolderKanban, CheckSquare, MapPin, Users, Building2,
  Package, FileText, Receipt, Euro, MessageSquare,
  Upload, Settings, BarChart3, CalendarDays, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/button';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Projets', href: '/projects', icon: FolderKanban },
  { label: 'Tâches', href: '/tasks', icon: CheckSquare },
  { label: 'Sites', href: '/sites', icon: MapPin },
  { label: 'Clients', href: '/clients', icon: Building2 },
  { label: 'Codes produits', href: '/products', icon: Package },
  { label: 'Commercial', href: '/commercial', icon: FileText },
  { label: 'Comptabilité', href: '/accounting', icon: Euro },
  { label: 'Employés', href: '/employees', icon: Users },
  { label: 'Congés', href: '/leaves', icon: CalendarDays },
  { label: 'Demandes', href: '/demands', icon: Receipt },
  { label: 'Messagerie', href: '/messages', icon: MessageSquare },
  { label: 'Import', href: '/import', icon: Upload },
  { label: 'Rapports', href: '/reports', icon: BarChart3 },
  { label: 'Administration', href: '/admin', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

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
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
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
