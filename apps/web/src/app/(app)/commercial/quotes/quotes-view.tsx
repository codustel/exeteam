'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PDFDownloadLink } from '@react-pdf/renderer';
import {
  Plus, Search, MoreHorizontal, FileCheck, Trash2, Pencil, Download,
} from 'lucide-react';
import { StatsBar } from '@exeteam/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
import { quotesApi } from '@/lib/api/commercial';
import { QuotePDF } from '@/components/pdf/quote-pdf';

const statusConfig: Record<string, { label: string; className: string }> = {
  brouillon: { label: 'Brouillon', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  envoye: { label: 'Envoyé', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  accepte: { label: 'Accepté', className: 'bg-green-100 text-green-700 border-green-200' },
  refuse: { label: 'Refusé', className: 'bg-red-100 text-red-700 border-red-200' },
  expire: { label: 'Expiré', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
};

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(n);

type QuoteLine = { designation: string; quantity: number; unitPrice: number };

const emptyLine = (): QuoteLine => ({ designation: '', quantity: 1, unitPrice: 0 });
const emptyForm = () => ({
  reference: '', clientId: '', projectId: '', status: 'brouillon',
  vatRate: 20, discount: 0, conditions: '', lines: [emptyLine()],
});

export function QuotesView() {
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
    queryKey: ['quotes', 'list', { search: debouncedSearch, page, statusFilter }],
    queryFn: () => quotesApi.list({
      search: debouncedSearch || undefined,
      page: String(page),
      limit: '20',
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }),
  });

  const quotes = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  const accepted = quotes.filter((q: any) => q.status === 'accepte').length;
  const pending = quotes.filter((q: any) => ['brouillon', 'envoye'].includes(q.status)).length;
  const totalAmount = quotes.reduce((s: number, q: any) => s + Number(q.totalHt), 0);

  const statsItems = [
    { label: 'Total devis', value: data?.total ?? '—', icon: FileCheck },
    { label: 'Acceptés', value: accepted, icon: FileCheck },
    { label: 'En attente', value: pending, icon: FileCheck },
    { label: 'Montant total HT', value: `${fmt(totalAmount)} €`, icon: FileCheck },
  ];

  const createMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) =>
      editId ? quotesApi.update(editId, d) : quotesApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setFormOpen(false);
      setEditId(null);
      setForm(emptyForm());
    },
    onError: (err: Error) => alert(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => quotesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setDeleteId(null);
    },
  });

  const openEdit = async (id: string) => {
    const q = await quotesApi.getOne(id);
    setEditId(id);
    setForm({
      reference: q.reference,
      clientId: q.clientId,
      projectId: q.projectId ?? '',
      status: q.status,
      vatRate: Number(q.vatRate),
      discount: Number(q.discount ?? 0),
      conditions: q.conditions ?? '',
      lines: q.lines.map((l: any) => ({
        designation: l.designation,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
      })),
    });
    setFormOpen(true);
  };

  const updateLine = (i: number, field: keyof QuoteLine, value: string | number) => {
    setForm((f) => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], [field]: value };
      return { ...f, lines };
    });
  };

  const addLine = () => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }));
  const removeLine = (i: number) =>
    setForm((f) => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));

  const totalHt = form.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const discounted = totalHt * (1 - (form.discount ?? 0) / 100);
  const vatAmount = discounted * (form.vatRate / 100);
  const totalTtc = discounted + vatAmount;

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
          Nouveau devis
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Projet</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Validité</TableHead>
              <TableHead className="text-right">HT</TableHead>
              <TableHead className="text-right">TTC</TableHead>
              <TableHead>Statut</TableHead>
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
            ) : quotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                  Aucun devis trouvé
                </TableCell>
              </TableRow>
            ) : (
              quotes.map((q: any) => {
                const sc = statusConfig[q.status] ?? { label: q.status, className: 'bg-gray-100 text-gray-600' };
                return (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs">{q.reference}</TableCell>
                    <TableCell className="text-sm">{q.client.name}</TableCell>
                    <TableCell className="text-sm">{q.project?.reference ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(q.quoteDate), 'dd/MM/yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {q.validUntil ? format(new Date(q.validUntil), 'dd/MM/yyyy', { locale: fr }) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {fmt(Number(q.totalHt))} {q.currency?.symbol ?? '€'}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {fmt(Number(q.totalTtc))} {q.currency?.symbol ?? '€'}
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
                          <DropdownMenuItem onClick={() => openEdit(q.id)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <PDFDownloadLink
                              document={
                                <QuotePDF quote={{
                                  reference: q.reference,
                                  quoteDate: q.quoteDate,
                                  validUntil: q.validUntil,
                                  status: q.status,
                                  client: q.client,
                                  lines: (q.lines ?? []).map((l: any) => ({
                                    designation: l.designation,
                                    quantity: Number(l.quantity),
                                    unitPrice: Number(l.unitPrice),
                                    totalHt: Number(l.totalHt),
                                  })),
                                  totalHt: Number(q.totalHt),
                                  vatAmount: Number(q.vatAmount),
                                  totalTtc: Number(q.totalTtc),
                                  vatRate: Number(q.vatRate),
                                  discount: q.discount ? Number(q.discount) : undefined,
                                  conditions: q.conditions,
                                  currency: q.currency,
                                }} />
                              }
                              fileName={`devis-${q.reference}.pdf`}
                              className="flex items-center px-2 py-1.5 text-sm cursor-pointer"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Télécharger PDF
                            </PDFDownloadLink>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(q.id)}
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
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} devis</p>
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

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => { if (!o) { setFormOpen(false); setEditId(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Modifier le devis' : 'Nouveau devis'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Référence</Label>
                <Input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} placeholder="DEV-2024-001" />
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
                <Label>TVA (%)</Label>
                <Input
                  type="number" min={0} max={100}
                  value={form.vatRate}
                  onChange={(e) => setForm((f) => ({ ...f, vatRate: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Remise (%)</Label>
                <Input
                  type="number" min={0} max={100}
                  value={form.discount}
                  onChange={(e) => setForm((f) => ({ ...f, discount: Number(e.target.value) }))}
                />
              </div>
            </div>

            {/* Lines editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Lignes</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-3 w-3 mr-1" /> Ajouter
                </Button>
              </div>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Désignation</TableHead>
                      <TableHead className="w-20">Qté</TableHead>
                      <TableHead className="w-28">P.U. HT</TableHead>
                      <TableHead className="w-28 text-right">Total HT</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.lines.map((line, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Input
                            value={line.designation}
                            onChange={(e) => updateLine(i, 'designation', e.target.value)}
                            placeholder="Description..."
                            className="border-0 shadow-none p-0 h-7"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number" min={0}
                            value={line.quantity}
                            onChange={(e) => updateLine(i, 'quantity', Number(e.target.value))}
                            className="border-0 shadow-none p-0 h-7"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number" min={0} step={0.01}
                            value={line.unitPrice}
                            onChange={(e) => updateLine(i, 'unitPrice', Number(e.target.value))}
                            className="border-0 shadow-none p-0 h-7"
                          />
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {fmt(line.quantity * line.unitPrice)} €
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button" variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => removeLine(i)}
                            disabled={form.lines.length === 1}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Totals preview */}
            <div className="border rounded-md p-3 bg-muted/30 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total HT</span>
                <span>{fmt(totalHt)} €</span>
              </div>
              {(form.discount ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Remise ({form.discount}%)</span>
                  <span>- {fmt(totalHt * (form.discount ?? 0) / 100)} €</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">TVA ({form.vatRate}%)</span>
                <span>{fmt(vatAmount)} €</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total TTC</span>
                <span>{fmt(totalTtc)} €</span>
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
                  status: form.status,
                  vatRate: form.vatRate,
                  discount: form.discount ?? undefined,
                  conditions: form.conditions || undefined,
                  lines: form.lines,
                })
              }
              disabled={createMutation.isPending}
              style={{ backgroundColor: '#FF6600' }}
              className="text-white hover:opacity-90"
            >
              {createMutation.isPending ? 'Enregistrement…' : editId ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le devis ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
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
