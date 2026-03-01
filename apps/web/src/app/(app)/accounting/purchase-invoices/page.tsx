'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { purchaseInvoicesApi } from '@/lib/api/accounting';
import {
  PURCHASE_INVOICE_STATUS_LABELS,
  PURCHASE_INVOICE_STATUS_COLORS,
  type PurchaseInvoiceStatus,
} from '@exeteam/shared';
import { StatsBar } from '@exeteam/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileText, Plus, MoreHorizontal, Search, Euro, AlertTriangle } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { PurchaseInvoiceFormDialog } from './purchase-invoice-form-dialog';

function formatCurrency(value: number) {
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €';
}

export default function PurchaseInvoicesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const debouncedSearch = useDebounce(search, 300);

  const { data: stats } = useQuery({
    queryKey: ['purchase-invoices', 'stats'],
    queryFn: () => purchaseInvoicesApi.getStats(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-invoices', 'list', { search: debouncedSearch, page }],
    queryFn: () => purchaseInvoicesApi.list({ search: debouncedSearch || undefined, page, limit: 20 }),
  });

  const statsItems = [
    { label: 'Total factures', value: stats?.total ?? '—', icon: FileText },
    { label: 'Total HT', value: stats ? formatCurrency(stats.totalHt) : '—', icon: Euro },
    { label: 'Montant dû', value: stats ? formatCurrency(stats.amountDue) : '—', icon: Euro },
    { label: 'En retard', value: stats?.overdue ?? '—', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Factures achats</h1>
        <Button onClick={() => { setEditingInvoice(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Nouvelle facture
        </Button>
      </div>

      <StatsBar stats={statsItems} />

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une facture..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead className="text-right">Total HT</TableHead>
              <TableHead className="text-right">Total TTC</TableHead>
              <TableHead className="text-right">Payé</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Aucune facture trouvée
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((invoice: any) => {
                const statusColor = PURCHASE_INVOICE_STATUS_COLORS[invoice.status as PurchaseInvoiceStatus];
                const statusLabel = PURCHASE_INVOICE_STATUS_LABELS[invoice.status as PurchaseInvoiceStatus] ?? invoice.status;
                return (
                  <TableRow key={invoice.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{invoice.reference}</TableCell>
                    <TableCell>{invoice.supplier?.name ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(invoice.invoiceDate).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('fr-FR') : '—'}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(invoice.totalHt))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(invoice.totalTtc))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(invoice.amountPaid))}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{
                          backgroundColor: statusColor + '20',
                          color: statusColor,
                          borderColor: statusColor + '40',
                        }}
                      >
                        {statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setEditingInvoice(invoice);
                            setDialogOpen(true);
                          }}>
                            Modifier
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

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{data.total} factures au total</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              Précédent
            </Button>
            <span className="flex items-center px-3">Page {page} / {data.pages}</span>
            <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>
              Suivant
            </Button>
          </div>
        </div>
      )}

      <PurchaseInvoiceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        invoiceId={editingInvoice?.id}
        defaultValues={editingInvoice ? {
          reference: editingInvoice.reference,
          supplierId: editingInvoice.supplierId,
          invoiceDate: editingInvoice.invoiceDate?.split('T')[0] ?? '',
          dueDate: editingInvoice.dueDate?.split('T')[0] ?? '',
          totalHt: Number(editingInvoice.totalHt),
          vatRate: 20,
          notes: editingInvoice.notes ?? '',
        } : undefined}
      />
    </div>
  );
}
