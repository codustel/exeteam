'use client';

import { useQuery } from '@tanstack/react-query';
import { tasksApi, type TaskListItem } from '@/lib/api/tasks';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  User, FolderKanban, AlertTriangle, ArrowUp, ArrowDown, Minus, Loader2,
} from 'lucide-react';
import Link from 'next/link';

const STATUS_ORDER = [
  'a_traiter',
  'en_cours',
  'en_revision',
  'terminee',
  'livree',
  'annulee',
] as const;

const STATUS_LABELS: Record<string, string> = {
  a_traiter: 'A traiter',
  en_cours: 'En cours',
  en_revision: 'En revision',
  terminee: 'Terminee',
  livree: 'Livree',
  annulee: 'Annulee',
};

const STATUS_HEADER_COLORS: Record<string, string> = {
  a_traiter: 'border-yellow-400 bg-yellow-50',
  en_cours: 'border-blue-400 bg-blue-50',
  en_revision: 'border-purple-400 bg-purple-50',
  terminee: 'border-green-400 bg-green-50',
  livree: 'border-emerald-400 bg-emerald-50',
  annulee: 'border-red-400 bg-red-50',
};

const STATUS_DOT_COLORS: Record<string, string> = {
  a_traiter: 'bg-yellow-400',
  en_cours: 'bg-blue-400',
  en_revision: 'bg-purple-400',
  terminee: 'bg-green-400',
  livree: 'bg-emerald-400',
  annulee: 'bg-red-400',
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: typeof ArrowUp }> = {
  basse: { label: 'Basse', color: 'bg-slate-100 text-slate-600', icon: ArrowDown },
  normale: { label: 'Normale', color: 'bg-blue-50 text-blue-700', icon: Minus },
  haute: { label: 'Haute', color: 'bg-orange-100 text-orange-700', icon: ArrowUp },
  urgente: { label: 'Urgente', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
};

interface TasksKanbanProps {
  search?: string;
  status?: string;
  facturable?: boolean;
}

function TaskCard({ task }: { task: TaskListItem }) {
  const priority = PRIORITY_CONFIG[task.priority];
  const PriorityIcon = priority?.icon ?? Minus;

  return (
    <Link href={`/tasks/${task.id}`} className="block">
      <Card className="p-3 hover:shadow-md transition-shadow cursor-pointer border hover:border-[#FF6600]/40 group">
        <div className="space-y-2">
          {/* Reference + Priority */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground group-hover:text-[#FF6600] transition-colors">
              {task.reference}
            </span>
            {priority && (
              <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-5 ${priority.color}`}>
                <PriorityIcon className="h-3 w-3 mr-0.5" />
                {priority.label}
              </Badge>
            )}
          </div>

          {/* Title */}
          <p className="text-sm font-medium leading-snug line-clamp-2">
            {task.title}
          </p>

          {/* Project */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FolderKanban className="h-3 w-3 shrink-0" />
            <span className="truncate">{task.project.reference} - {task.project.title}</span>
          </div>

          {/* Assignee + Facturable */}
          <div className="flex items-center justify-between pt-1 border-t">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {task.employee
                  ? `${task.employee.firstName} ${task.employee.lastName}`
                  : 'Non assigne'}
              </span>
            </div>
            {task.facturable && (
              <Badge className="bg-[#FF6600]/10 text-[#FF6600] border-[#FF6600]/20 text-[10px] px-1.5 py-0 h-5">
                Fact.
              </Badge>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

export function TasksKanban({ search, status, facturable }: TasksKanbanProps) {
  // Fetch all tasks (no pagination for kanban, use a high limit)
  const { data, isLoading } = useQuery({
    queryKey: ['tasks', 'kanban', { search, status, facturable }],
    queryFn: () =>
      tasksApi.list({
        search: search || undefined,
        status: status || undefined,
        facturable,
        page: 1,
        limit: 200,
      }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Chargement du kanban...
      </div>
    );
  }

  const tasks = data?.data ?? [];

  // Group tasks by status
  const columns: Record<string, TaskListItem[]> = {};
  for (const s of STATUS_ORDER) {
    columns[s] = [];
  }
  for (const task of tasks) {
    if (columns[task.status]) {
      columns[task.status].push(task);
    } else {
      // Fallback for unknown statuses
      if (!columns['a_traiter']) columns['a_traiter'] = [];
      columns['a_traiter'].push(task);
    }
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
      {STATUS_ORDER.map((statusKey) => {
        const columnTasks = columns[statusKey] ?? [];
        return (
          <div
            key={statusKey}
            className="flex flex-col shrink-0 w-72"
          >
            {/* Column Header */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg border-t-2 ${STATUS_HEADER_COLORS[statusKey]}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT_COLORS[statusKey]}`} />
              <span className="text-sm font-semibold">{STATUS_LABELS[statusKey]}</span>
              <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5">
                {columnTasks.length}
              </Badge>
            </div>

            {/* Column Body */}
            <ScrollArea className="flex-1 rounded-b-lg border border-t-0 bg-muted/30">
              <div className="p-2 space-y-2" style={{ minHeight: '200px' }}>
                {columnTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Aucune tache
                  </p>
                ) : (
                  columnTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
