'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PDFDownloadLink } from '@react-pdf/renderer';
import {
  Plus, Search, MoreHorizontal, Receipt, Trash2, Pencil, Download, CreditCard,
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
import { invoicesApi } from '@/lib/api/commercial';
import { InvoicePDF } from '@/components/pdf/invoice-pdf';

const statusConfig: Record<string, { label: string; className: string }> = {
  brouillon: { label: 'Brouillon', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  envoye: { label: 'Envoyée', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  paye: { label: 'Payée', className: 'bg-green-100 text-green-700 border-green-200' },
  retard: { label: 'En retard', className: 'bg-red-100 text-red-700 border-red-200' },
  annule: { label: 'Annulée', className: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(n);

type InvoiceLine = { designation: string; quantity: number; unitPrice: number };
const emptyLine = (): InvoiceLine => ({ designation: '', quantity: 1, unitPrice: 0 });
const emptyForm = () => ({
  reference: '', clientId: '', vatRate: 20, lines: [emptyLine()],
});

export function InvoicesView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [form, setForm] = useState(emptyForm());

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', 'list', { search: debouncedSearch, page, statusFilter }],
    queryFn: () => invoicesApi.list({
      search: debouncedSearch || undefined,
      page: String(page),
      limit: '20',
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }),
  });

  const invoices = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  const paid = invoices.filter((i: any) => i.status === 'paye').length;
  const pending = invoices.filter((i: any) => ['brouillon', 'envoye'].includes(i.status)).length;
  const overdue = invoices.filter((i: any) => i.status === 'retard').length;

  const statsItems = [
    { label: 'Total factures', value: data?.total ?? '—', icon: Receipt },
    { label: 'Payées', value: paid, icon: Receipt },
    { label: 'En attente', value: pending, icon: Receipt },
    { label: 'En retard', value: overdue, icon: Receipt },
  ];

  const createMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) =>
      editId ? invoicesApi.update(editId, d) : invoicesApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setFormOpen(false);
      setEditId(null);
      setForm(emptyForm());
    },
    onError: (err: Error) => alert(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => invoicesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setDeleteId(null);
    },
  });

  const paymentMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      invoicesApi.recordPayment(id, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setPaymentId(null);
      setPaymentAmount('');
    },
    onError: (err: Error) => alert(err.message),
  });

  const openEdit = async (id: string) => {
    const inv = await invoicesApi.getOne(id);
    setEditId(id);
    setForm({
      reference: inv.reference,
      clientId: inv.clientId,
      vatRate: Number(inv.vatRate),
      lines: inv.lines.map((l: any) => ({
        designation: l.designation,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
      })),
    });
    setFormOpen(true);
  };

  const updateLine = (i: number, field: keyof InvoiceLine, value: string | number) => {
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
  const vatAmount = totalHt * (form.vatRate / 100);
  const totalTtc = totalHt + vatAmount;

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
          Nouvelle facture
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead className="text-right">HT</TableHead>
              <TableHead className="text-right">TTC</TableHead>
              <TableHead className="text-right">Payé</TableHead>
              <TableHead className="text-right">Reste dû</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                  Aucune facture trouvée
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv: any) => {
                const sc = statusConfig[inv.status] ?? { label: inv.status, className: 'bg-gray-100 text-gray-600' };
                const remaining = Number(inv.totalTtc) - Number(inv.amountPaid ?? 0);
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.reference}</TableCell>
                    <TableCell className="text-sm">{inv.client.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(inv.invoiceDate), 'dd/MM/yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {inv.dueDate ? format(new Date(inv.dueDate), 'dd/MM/yyyy', { locale: fr }) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {fmt(Number(inv.totalHt))} {inv.currency?.symbol ?? '€'}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {fmt(Number(inv.totalTtc))} {inv.currency?.symbol ?? '€'}
                    </TableCell>
                    <TableCell className="text-right text-sm text-green-700">
                      {fmt(Number(inv.amountPaid ?? 0))} {inv.currency?.symbol ?? '€'}
                    </TableCell>
                    <TableCell className={`text-right text-sm font-medium ${remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {fmt(remaining)} {inv.currency?.symbol ?? '€'}
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
                          <DropdownMenuItem onClick={() => openEdit(inv.id)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => { setPaymentId(inv.id); setPaymentAmount(''); }}
                          >
                            <CreditCard className="h-4 w-4 mr-2" />
                            Enregistrer paiement
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <PDFDownloadLink
                              document={
                                <InvoicePDF invoice={{
                                  reference: inv.reference,
                                  invoiceDate: inv.invoiceDate,
                                  dueDate: inv.dueDate,
                                  status: inv.status,
                                  client: inv.client,
                                  lines: (inv.lines ?? []).map((l: any) => ({
                                    designation: l.designation,
                                    quantity: Number(l.quantity),
                                    unitPrice: Number(l.unitPrice),
                                    totalHt: Number(l.totalHt),
                                  })),
                                  totalHt: Number(inv.totalHt),
                                  vatAmount: Number(inv.vatAmount),
                                  totalTtc: Number(inv.totalTtc),
                                  vatRate: Number(inv.vatRate),
                                  amountPaid: Number(inv.amountPaid ?? 0),
                                  currency: inv.currency,
                                  order: inv.order,
                                  attachment: inv.attachment,
                                }} />
                              }
                              fileName={`facture-${inv.reference}.pdf`}
                              className="flex items-center px-2 py-1.5 text-sm cursor-pointer"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Télécharger PDF
                            </PDFDownloadLink>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(inv.id)}
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
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} facture{(data?.total ?? 0) > 1 ? 's' : ''}</p>
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

      {/* Create / Edit Form Dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => { if (!o) { setFormOpen(false); setEditId(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Modifier la facture' : 'Nouvelle facture'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Référence</Label>
                <Input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} placeholder="FAC-2024-001" />
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
                  vatRate: form.vatRate,
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

      {/* Payment Dialog */}
      <Dialog open={!!paymentId} onOpenChange={(o) => { if (!o) setPaymentId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enregistrer un paiement</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Montant payé (€)</Label>
            <Input
              type="number" min={0} step={0.01}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentId(null)}>Annuler</Button>
            <Button
              onClick={() =>
                paymentId &&
                paymentMutation.mutate({ id: paymentId, amount: Number(paymentAmount) })
              }
              disabled={!paymentAmount || paymentMutation.isPending}
              style={{ backgroundColor: '#FF6600' }}
              className="text-white hover:opacity-90"
            >
              {paymentMutation.isPending ? 'Enregistrement…' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la facture ?</AlertDialogTitle>
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
