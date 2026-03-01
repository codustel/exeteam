'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tasksApi, type TaskListItem } from '@/lib/api/tasks';
import { StatsBar } from '@exeteam/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CheckSquare, Clock, TrendingUp, Plus, Search, MoreHorizontal, Activity,
  LayoutList, Columns3,
} from 'lucide-react';
import Link from 'next/link';
import { useDebounce } from '@/hooks/use-debounce';
import { TaskFormDialog } from './task-form-dialog';
import { TasksKanban } from './tasks-kanban';

const STATUS_LABELS: Record<string, string> = {
  a_traiter: 'À traiter',
  en_cours: 'En cours',
  en_revision: 'En révision',
  terminee: 'Terminée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

const STATUS_COLORS: Record<string, string> = {
  a_traiter: 'bg-yellow-100 text-yellow-800',
  en_cours: 'bg-blue-100 text-blue-800',
  en_revision: 'bg-purple-100 text-purple-800',
  terminee: 'bg-green-100 text-green-800',
  livree: 'bg-emerald-100 text-emerald-800',
  annulee: 'bg-red-50 text-red-700',
};

type ViewMode = 'table' | 'kanban';

export function TasksClient() {
  const [view, setView] = useState<ViewMode>('table');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [facturable, setFacturable] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data: stats } = useQuery({
    queryKey: ['tasks', 'stats'],
    queryFn: () => tasksApi.getStats(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', 'list', { search: debouncedSearch, status, facturable, page }],
    queryFn: () =>
      tasksApi.list({
        search: debouncedSearch || undefined,
        status: status || undefined,
        facturable: facturable === '' ? undefined : facturable === 'true',
        page,
        limit: 25,
      }),
  });

  const statsItems = [
    { label: 'Total tâches', value: stats?.total ?? '—', icon: CheckSquare },
    { label: 'En cours', value: stats?.inProgress ?? '—', icon: Clock },
    { label: 'Terminées ce mois', value: stats?.doneThisMonth ?? '—', icon: Activity },
    {
      label: 'Taux rendement moy.',
      value: stats ? `${stats.avgRendement}%` : '—',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-4">
      <StatsBar stats={statsItems} />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une tâche..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={facturable} onValueChange={(v) => { setFacturable(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Facturable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="true">Facturable</SelectItem>
              <SelectItem value="false">Non facturable</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-lg p-0.5">
            <Button
              variant={view === 'table' ? 'default' : 'ghost'}
              size="sm"
              className={`h-8 px-3 ${view === 'table' ? 'bg-[#FF6600] hover:bg-[#FF6600]/90 text-white' : ''}`}
              onClick={() => setView('table')}
            >
              <LayoutList className="h-4 w-4 mr-1.5" />
              Table
            </Button>
            <Button
              variant={view === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              className={`h-8 px-3 ${view === 'kanban' ? 'bg-[#FF6600] hover:bg-[#FF6600]/90 text-white' : ''}`}
              onClick={() => setView('kanban')}
            >
              <Columns3 className="h-4 w-4 mr-1.5" />
              Kanban
            </Button>
          </div>
          <Button onClick={() => setCreateOpen(true)} style={{ backgroundColor: '#FF6600' }}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle tâche
          </Button>
        </div>
      </div>

      {view === 'kanban' ? (
        <TasksKanban
          search={debouncedSearch || undefined}
          status={status || undefined}
          facturable={facturable === '' ? undefined : facturable === 'true'}
        />
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Titre</TableHead>
                  <TableHead>Projet</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Assigné</TableHead>
                  <TableHead>Code produit</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Facturable</TableHead>
                  <TableHead>Délai R-L</TableHead>
                  <TableHead>Rendement</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : data?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      Aucune tâche trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data.map((task: TaskListItem) => (
                    <TableRow key={task.id} className="hover:bg-muted/50">
                      <TableCell>
                        <Link href={`/tasks/${task.id}`} className="font-mono text-xs text-primary hover:underline">
                          {task.reference}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/tasks/${task.id}`} className="font-medium text-sm hover:text-primary">
                          {task.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <Link href={`/projects/${task.project.id}`} className="hover:text-primary">
                          {task.project.reference}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {task.site?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {task.employee
                          ? `${task.employee.firstName} ${task.employee.lastName}`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {task.codeProduit ? (
                          <Badge variant="outline" className="text-xs font-mono">
                            {task.codeProduit.code}
                          </Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status] ?? 'bg-gray-100 text-gray-700'}`}>
                          {STATUS_LABELS[task.status] ?? task.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {task.facturable ? (
                          <Badge className="bg-[#FF6600]/10 text-[#FF6600] border-[#FF6600]/20 text-xs">
                            Oui
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Non</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {task.delaiRL !== null ? (
                          <span className={task.delaiRL > 10 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                            {task.delaiRL}j
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {task.rendement !== null ? (
                          <span className={
                            task.rendement >= 90
                              ? 'text-green-600 font-medium'
                              : task.rendement >= 70
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }>
                            {task.rendement}%
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/tasks/${task.id}`}>Voir le détail</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/projects/${task.project.id}?tab=taches`}>
                                Voir le projet
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {data && data.pages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{data.total} tâches au total</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  Précédent
                </Button>
                <span className="flex items-center px-3">Page {page} / {data.pages}</span>
                <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <TaskFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
