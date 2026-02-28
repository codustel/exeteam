'use client';

import { useState } from 'react';
import { projectsApi, type ProjectDetail, type TaskSummary } from '@/lib/api/projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, LayoutList, Columns, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useDebounce } from '@/hooks/use-debounce';

const STATUS_LABELS: Record<string, string> = {
  a_traiter: 'À traiter',
  en_cours: 'En cours',
  en_revision: 'En révision',
  terminee: 'Terminée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

const STATUS_COLORS: Record<string, string> = {
  a_traiter: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  en_cours: 'bg-blue-100 text-blue-800 border-blue-200',
  en_revision: 'bg-purple-100 text-purple-800 border-purple-200',
  terminee: 'bg-green-100 text-green-800 border-green-200',
  livree: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  annulee: 'bg-red-50 text-red-700 border-red-200',
};

const KANBAN_COLUMNS = ['a_traiter', 'en_cours', 'en_revision', 'terminee', 'livree'];

interface Props {
  project: ProjectDetail;
}

export function ProjectTasksTab({ project }: Props) {
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Get statuses from project config if overridden
  const configStatuses =
    project.customFieldsConfig &&
    typeof project.customFieldsConfig === 'object' &&
    Array.isArray((project.customFieldsConfig as Record<string, unknown>)['statuses'])
      ? ((project.customFieldsConfig as Record<string, unknown>)['statuses'] as string[])
      : KANBAN_COLUMNS;

  const tasks = project.tasks.filter((t: TaskSummary) => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.reference.toLowerCase().includes(q);
  });

  const tasksByStatus = configStatuses.reduce<Record<string, TaskSummary[]>>((acc, s) => {
    acc[s] = tasks.filter((t) => t.status === s);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une tâche..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-r-none"
              onClick={() => setViewMode('kanban')}
            >
              <Columns className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-l-none"
              onClick={() => setViewMode('list')}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Link href={`/tasks/new?projectId=${project.id}`}>
          <Button style={{ backgroundColor: '#FF6600' }}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle tâche
          </Button>
        </Link>
      </div>

      {viewMode === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {configStatuses.map((status) => {
            const colTasks = tasksByStatus[status] ?? [];
            return (
              <div key={status} className="flex-shrink-0 w-72">
                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_LABELS[status] ?? status}
                  </span>
                  <span className="text-xs text-muted-foreground">{colTasks.length}</span>
                </div>
                <div className="space-y-2 min-h-24">
                  {colTasks.map((task) => (
                    <Link key={task.id} href={`/tasks/${task.id}`}>
                      <div className="bg-card border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium line-clamp-2">{task.title}</p>
                          <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                        </div>
                        <p className="text-xs font-mono text-muted-foreground">{task.reference}</p>
                        {task.employee && (
                          <p className="text-xs text-muted-foreground">
                            {task.employee.firstName} {task.employee.lastName}
                          </p>
                        )}
                        {task.codeProduit && (
                          <Badge variant="outline" className="text-xs">
                            {task.codeProduit.code}
                          </Badge>
                        )}
                        {task.facturable && (
                          <Badge className="text-xs bg-[#FF6600]/10 text-[#FF6600] border-[#FF6600]/20">
                            Facturable
                          </Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                  {colTasks.length === 0 && (
                    <div className="border-2 border-dashed rounded-lg p-4 text-center text-xs text-muted-foreground">
                      Aucune tâche
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {tasks.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Aucune tâche pour ce projet
            </div>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/tasks/${task.id}`} className="font-medium text-sm hover:text-primary truncate">
                      {task.title}
                    </Link>
                    <span className="text-xs font-mono text-muted-foreground">{task.reference}</span>
                  </div>
                  {task.employee && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {task.employee.firstName} {task.employee.lastName}
                    </p>
                  )}
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status] ?? 'bg-gray-100 text-gray-700'}`}>
                  {STATUS_LABELS[task.status] ?? task.status}
                </span>
                {task.facturable && (
                  <Badge variant="outline" className="text-xs border-[#FF6600]/40 text-[#FF6600]">
                    Facturable
                  </Badge>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
