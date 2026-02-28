'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Plus, Search, MoreHorizontal, FileText, CheckCircle, Clock,
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useDebounce } from '@/hooks/use-debounce';
import { attachmentsApi } from '@/lib/api/commercial';

const statusConfig: Record<string, { label: string; className: string }> = {
  genere: { label: 'Généré', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  envoye: { label: 'Envoyé', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  valide: { label: 'Validé', className: 'bg-green-100 text-green-700 border-green-200' },
  facture: { label: 'Facturé', className: 'bg-purple-100 text-purple-700 border-purple-200' },
};

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(n);

export function AttachmentsView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [statusDialogId, setStatusDialogId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState('');

  // Generate form state
  const [genForm, setGenForm] = useState({
    reference: '', clientId: '', period: '', projectId: '',
    taskIds: [] as string[],
  });

  const debouncedSearch = useDebounce(search, 300);

  const { data: stats } = useQuery({
    queryKey: ['attachments', 'stats'],
    queryFn: () => attachmentsApi.getStats(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['attachments', 'list', { search: debouncedSearch, page, statusFilter }],
    queryFn: () => attachmentsApi.list({
      search: debouncedSearch || undefined,
      page,
      limit: 20,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }),
  });

  const createMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => attachmentsApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments'] });
      setCreateOpen(false);
      setGenForm({ reference: '', clientId: '', period: '', projectId: '', taskIds: [] });
    },
    onError: (err: Error) => alert(err.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      attachmentsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments'] });
      setStatusDialogId(null);
    },
  });

  const statsItems = [
    { label: 'Total bordereaux', value: stats?.total ?? '—', icon: FileText },
    { label: 'Montant en attente', value: stats?.pendingAmount != null ? `${fmt(stats.pendingAmount)} €` : '—', icon: Clock },
    {
      label: 'Générés',
      value: stats?.byStatus?.find((s: any) => s.status === 'genere')?._count ?? 0,
      icon: FileText,
    },
    {
      label: 'Envoyés',
      value: stats?.byStatus?.find((s: any) => s.status === 'envoye')?._count ?? 0,
      icon: CheckCircle,
    },
  ];

  const attachments = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  return (
    <div className="space-y-4">
      <StatsBar stats={statsItems} />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher (référence)..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="genere">Généré</SelectItem>
              <SelectItem value="envoye">Envoyé</SelectItem>
              <SelectItem value="valide">Validé</SelectItem>
              <SelectItem value="facture">Facturé</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          style={{ backgroundColor: '#FF6600' }}
          className="text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Générer un bordereau
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Projet</TableHead>
              <TableHead>Période</TableHead>
              <TableHead className="text-right">Montant HT</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-center">Lignes</TableHead>
              <TableHead className="text-center">Factures</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : attachments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                  Aucun bordereau trouvé
                </TableCell>
              </TableRow>
            ) : (
              attachments.map((att: any) => {
                const sc = statusConfig[att.status] ?? { label: att.status, className: 'bg-gray-100 text-gray-600' };
                return (
                  <TableRow key={att.id}>
                    <TableCell className="font-mono text-xs">{att.reference}</TableCell>
                    <TableCell className="text-sm">{att.client.name}</TableCell>
                    <TableCell className="text-sm">{att.project?.reference ?? '—'}</TableCell>
                    <TableCell className="text-sm">{att.period}</TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {fmt(Number(att.totalHt))} {att.currency?.symbol ?? '€'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={sc.className}>{sc.label}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm">{att._count.lines}</TableCell>
                    <TableCell className="text-center text-sm">{att._count.invoices}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setStatusDialogId(att.id);
                              setNewStatus(att.status);
                            }}
                          >
                            Changer statut
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} bordereau(x)</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              Précédent
            </Button>
            <span className="text-sm">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              Suivant
            </Button>
          </div>
        </div>
      )}

      {/* Generate Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Générer un bordereau</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Référence</Label>
              <Input
                placeholder="BOR-2024-01"
                value={genForm.reference}
                onChange={(e) => setGenForm((f) => ({ ...f, reference: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>ID Client (UUID)</Label>
              <Input
                placeholder="uuid du client"
                value={genForm.clientId}
                onChange={(e) => setGenForm((f) => ({ ...f, clientId: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Période (YYYY-MM)</Label>
              <Input
                placeholder="2024-01"
                value={genForm.period}
                onChange={(e) => setGenForm((f) => ({ ...f, period: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>IDs tâches (1 par ligne)</Label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                placeholder="uuid-tache-1&#10;uuid-tache-2"
                value={genForm.taskIds.join('\n')}
                onChange={(e) =>
                  setGenForm((f) => ({
                    ...f,
                    taskIds: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button
              onClick={() =>
                createMutation.mutate({
                  reference: genForm.reference,
                  clientId: genForm.clientId,
                  period: genForm.period,
                  taskIds: genForm.taskIds,
                  ...(genForm.projectId ? { projectId: genForm.projectId } : {}),
                })
              }
              disabled={createMutation.isPending}
              style={{ backgroundColor: '#FF6600' }}
              className="text-white hover:opacity-90"
            >
              {createMutation.isPending ? 'Génération…' : 'Générer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Dialog */}
      <Dialog open={!!statusDialogId} onOpenChange={(o) => !o && setStatusDialogId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Changer le statut</DialogTitle>
          </DialogHeader>
          <Select value={newStatus} onValueChange={setNewStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="genere">Généré</SelectItem>
              <SelectItem value="envoye">Envoyé</SelectItem>
              <SelectItem value="valide">Validé</SelectItem>
              <SelectItem value="facture">Facturé</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogId(null)}>Annuler</Button>
            <Button
              onClick={() =>
                statusDialogId && updateStatusMutation.mutate({ id: statusDialogId, status: newStatus })
              }
              disabled={updateStatusMutation.isPending}
              style={{ backgroundColor: '#FF6600' }}
              className="text-white hover:opacity-90"
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
