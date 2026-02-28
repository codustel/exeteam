'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Plus, Search, MoreHorizontal, Eye, Pencil, Repeat2, Trash2,
  ClipboardList, Loader2,
} from 'lucide-react';
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDebounce } from '@/hooks/use-debounce';
import { demandsApi, type DemandStatus, type DemandPriority } from '@/lib/api/demands';
import { DemandFormDialog } from './demand-form-dialog';

const statusConfig: Record<DemandStatus, { label: string; className: string }> = {
  nouvelle: { label: 'Nouvelle', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  en_cours: { label: 'En cours', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  terminee: { label: 'Terminée', className: 'bg-green-100 text-green-700 border-green-200' },
  annulee: { label: 'Annulée', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const priorityConfig: Record<DemandPriority, { label: string; className: string }> = {
  basse: { label: 'Basse', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  normale: { label: 'Normale', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  haute: { label: 'Haute', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  urgente: { label: 'Urgente', className: 'bg-red-100 text-red-700 border-red-200' },
};

export function DemandsTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<DemandStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<DemandPriority | 'all'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editDemand, setEditDemand] = useState<{ id: string; values: Record<string, unknown> } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data: stats } = useQuery({
    queryKey: ['demands', 'stats'],
    queryFn: () => demandsApi.getStats(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['demands', 'list', { search: debouncedSearch, page, statusFilter, priorityFilter }],
    queryFn: () =>
      demandsApi.list({
        search: debouncedSearch || undefined,
        page,
        limit: 20,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => demandsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demands'] });
      setDeleteId(null);
    },
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) => demandsApi.convertToTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demands'] });
      setConvertingId(null);
    },
    onError: (err: Error) => {
      alert(err.message);
      setConvertingId(null);
    },
  });

  const statsItems = [
    { label: 'Nouvelles', value: stats?.nouvelles ?? '—', icon: ClipboardList },
    { label: 'En cours', value: stats?.enCours ?? '—', icon: ClipboardList },
    { label: 'Terminées ce mois', value: stats?.termineesThisMonth ?? '—', icon: ClipboardList },
    { label: 'À convertir', value: stats?.aConvertir ?? '—', icon: Repeat2 },
  ];

  const demands = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  return (
    <div className="space-y-4">
      <StatsBar stats={statsItems} />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher (titre, référence)..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => { setStatusFilter(v as DemandStatus | 'all'); setPage(1); }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="nouvelle">Nouvelle</SelectItem>
              <SelectItem value="en_cours">En cours</SelectItem>
              <SelectItem value="terminee">Terminée</SelectItem>
              <SelectItem value="annulee">Annulée</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={priorityFilter}
            onValueChange={(v) => { setPriorityFilter(v as DemandPriority | 'all'); setPage(1); }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Priorité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes priorités</SelectItem>
              <SelectItem value="basse">Basse</SelectItem>
              <SelectItem value="normale">Normale</SelectItem>
              <SelectItem value="haute">Haute</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          style={{ backgroundColor: '#FF6600' }}
          className="text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle demande
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">Référence</TableHead>
              <TableHead>Titre</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Projet</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Demandeur</TableHead>
              <TableHead>Assigné</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Priorité</TableHead>
              <TableHead>Date demande</TableHead>
              <TableHead>Livraison</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 12 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-muted animate-pulse rounded" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : demands.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-10 text-muted-foreground">
                  Aucune demande trouvée
                </TableCell>
              </TableRow>
            ) : (
              demands.map((demand) => {
                const sc = statusConfig[demand.status];
                const pc = priorityConfig[demand.priority];
                return (
                  <TableRow key={demand.id}>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {demand.reference}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      <Link href={`/demands/${demand.id}`} className="hover:underline">
                        {demand.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{demand.client.name}</TableCell>
                    <TableCell className="text-sm">{demand.project.name}</TableCell>
                    <TableCell className="text-sm">{demand.site?.name ?? '—'}</TableCell>
                    <TableCell className="text-sm">
                      {demand.demandeur
                        ? `${demand.demandeur.firstName} ${demand.demandeur.lastName}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {demand.employee
                        ? `${demand.employee.firstName} ${demand.employee.lastName}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={sc.className}>{sc.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={pc.className}>{pc.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(demand.requestedAt), 'dd/MM/yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {demand.desiredDelivery
                        ? format(new Date(demand.desiredDelivery), 'dd/MM/yyyy', { locale: fr })
                        : '—'}
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
                            <Link href={`/demands/${demand.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              Voir
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setEditDemand({
                                id: demand.id,
                                values: {
                                  clientId: demand.client.id,
                                  projectId: demand.project.id,
                                  title: demand.title,
                                  description: demand.description ?? '',
                                  status: demand.status,
                                  priority: demand.priority,
                                },
                              })
                            }
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Modifier
                          </DropdownMenuItem>
                          {!demand.task && demand.status !== 'terminee' && demand.status !== 'annulee' && (
                            <DropdownMenuItem
                              onClick={() => {
                                setConvertingId(demand.id);
                                convertMutation.mutate(demand.id);
                              }}
                              disabled={convertingId === demand.id}
                            >
                              {convertingId === demand.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Repeat2 className="h-4 w-4 mr-2" />
                              )}
                              Convertir en tâche
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(demand.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {data?.total ?? 0} demande{(data?.total ?? 0) > 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Précédent
            </Button>
            <span className="text-sm">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <DemandFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Edit Dialog */}
      {editDemand && (
        <DemandFormDialog
          open={!!editDemand}
          onOpenChange={(o) => !o && setEditDemand(null)}
          demandId={editDemand.id}
          defaultValues={editDemand.values as Record<string, string>}
        />
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o: boolean) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la demande ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La demande sera archivée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
