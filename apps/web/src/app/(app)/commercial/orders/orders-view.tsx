'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Plus, Search, MoreHorizontal, ShoppingCart, Trash2, Pencil,
} from 'lucide-react';
import { StatsBar } from '@exeteam/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDebounce } from '@/hooks/use-debounce';
import { ordersApi } from '@/lib/api/commercial';

const statusConfig: Record<string, { label: string; className: string }> = {
  brouillon: { label: 'Brouillon', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  confirme: { label: 'Confirm\u00e9', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  en_cours: { label: 'En cours', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  livre: { label: 'Livr\u00e9', className: 'bg-green-100 text-green-700 border-green-200' },
  annule: { label: 'Annul\u00e9', className: 'bg-red-100 text-red-700 border-red-200' },
};

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(n);

const emptyForm = () => ({
  reference: '',
  clientId: '',
  quoteId: '',
  status: 'brouillon',
  amount: 0,
  notes: '',
});

export function OrdersView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', 'list', { search: debouncedSearch, page, statusFilter }],
    queryFn: () => ordersApi.list({
      search: debouncedSearch || undefined,
      page: String(page),
      limit: '20',
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }),
  });

  const orders = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  const confirmed = orders.filter((o: any) => o.status === 'confirme').length;
  const pending = orders.filter((o: any) => o.status === 'brouillon').length;
  const totalAmount = orders.reduce((s: number, o: any) => s + Number(o.amount), 0);

  const statsItems = [
    { label: 'Total commandes', value: data?.total ?? '\u2014', icon: ShoppingCart },
    { label: 'Confirm\u00e9es', value: confirmed, icon: ShoppingCart },
    { label: 'Brouillons', value: pending, icon: ShoppingCart },
    { label: 'Montant total', value: `${fmt(totalAmount)} \u20ac`, icon: ShoppingCart },
  ];

  const createMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) =>
      editId ? ordersApi.update(editId, d) : ordersApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setFormOpen(false);
      setEditId(null);
      setForm(emptyForm());
    },
    onError: (err: Error) => alert(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ordersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setDeleteId(null);
    },
  });

  const openEdit = async (id: string) => {
    const o = await ordersApi.getOne(id);
    setEditId(id);
    setForm({
      reference: o.reference,
      clientId: o.clientId,
      quoteId: o.quoteId ?? '',
      status: o.status,
      amount: Number(o.amount),
      notes: o.notes ?? '',
    });
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <StatsBar stats={statsItems} />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher (r\u00e9f\u00e9rence)..."
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
              {Object.entries(statusConfig).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => { setEditId(null); setForm(emptyForm()); setFormOpen(true); }}
          style={{ backgroundColor: '#FF6600' }}
          className="text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle commande
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>R\u00e9f\u00e9rence</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Devis li\u00e9</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  Aucune commande trouv\u00e9e
                </TableCell>
              </TableRow>
            ) : (
              orders.map((o: any) => {
                const sc = statusConfig[o.status] ?? { label: o.status, className: 'bg-gray-100 text-gray-600' };
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.reference}</TableCell>
                    <TableCell className="text-sm">{o.client?.name ?? '\u2014'}</TableCell>
                    <TableCell className="text-sm">{o.quote?.reference ?? '\u2014'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.orderDate ? format(new Date(o.orderDate), 'dd/MM/yyyy', { locale: fr }) : '\u2014'}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {fmt(Number(o.amount))} \u20ac
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={sc.className}>{sc.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(o.id)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(o.id)}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} commandes</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              Pr\u00e9c\u00e9dent
            </Button>
            <span className="text-sm">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              Suivant
            </Button>
          </div>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => { if (!o) { setFormOpen(false); setEditId(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Modifier la commande' : 'Nouvelle commande'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>R\u00e9f\u00e9rence</Label>
                <Input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} placeholder="CMD-2024-001" />
              </div>
              <div className="space-y-1">
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>ID Client (UUID)</Label>
                <Input value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))} placeholder="uuid" />
              </div>
              <div className="space-y-1">
                <Label>ID Devis (UUID, optionnel)</Label>
                <Input value={form.quoteId} onChange={(e) => setForm((f) => ({ ...f, quoteId: e.target.value }))} placeholder="uuid" />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Montant</Label>
                <Input
                  type="number" min={0} step={0.01}
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes internes..."
                  rows={3}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFormOpen(false); setEditId(null); }}>Annuler</Button>
            <Button
              onClick={() =>
                createMutation.mutate({
                  reference: form.reference,
                  clientId: form.clientId,
                  quoteId: form.quoteId || undefined,
                  status: form.status,
                  amount: form.amount,
                  notes: form.notes || undefined,
                })
              }
              disabled={createMutation.isPending}
              style={{ backgroundColor: '#FF6600' }}
              className="text-white hover:opacity-90"
            >
              {createMutation.isPending ? 'Enregistrement\u2026' : editId ? 'Mettre \u00e0 jour' : 'Cr\u00e9er'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la commande ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irr\u00e9versible.</AlertDialogDescription>
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
