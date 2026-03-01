'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { suppliersApi } from '@/lib/api/accounting';
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
import { Building2, Plus, MoreHorizontal, Search, CheckCircle, XCircle, Euro } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { SupplierFormDialog } from './supplier-form-dialog';

export default function SuppliersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const debouncedSearch = useDebounce(search, 300);

  const { data: stats } = useQuery({
    queryKey: ['suppliers', 'stats'],
    queryFn: () => suppliersApi.getStats(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', 'list', { search: debouncedSearch, page }],
    queryFn: () => suppliersApi.list({ search: debouncedSearch || undefined, page, limit: 20 }),
  });

  const statsItems = [
    { label: 'Total', value: stats?.total ?? '—', icon: Building2 },
    { label: 'Actifs', value: stats?.active ?? '—', icon: CheckCircle },
    { label: 'Inactifs', value: stats?.inactive ?? '—', icon: XCircle },
    { label: 'Total achats HT', value: stats ? `${stats.totalPurchaseHt.toLocaleString('fr-FR')} €` : '—', icon: Euro },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fournisseurs</h1>
        <Button onClick={() => { setEditingSupplier(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Nouveau fournisseur
        </Button>
      </div>

      <StatsBar stats={statsItems} />

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un fournisseur..."
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
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>SIRET</TableHead>
              <TableHead>Factures</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Aucun fournisseur trouvé
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((supplier: any) => (
                <TableRow key={supplier.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell className="text-muted-foreground">{supplier.email ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{supplier.phone ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{supplier.siret ?? '—'}</TableCell>
                  <TableCell>{supplier._count?.purchaseInvoices ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={supplier.isActive ? 'default' : 'secondary'}>
                      {supplier.isActive ? 'Actif' : 'Inactif'}
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
                          setEditingSupplier(supplier);
                          setDialogOpen(true);
                        }}>
                          Modifier
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
          <span>{data.total} fournisseurs au total</span>
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

      <SupplierFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplierId={editingSupplier?.id}
        defaultValues={editingSupplier ? {
          name: editingSupplier.name,
          email: editingSupplier.email ?? '',
          phone: editingSupplier.phone ?? '',
          address: editingSupplier.address ?? '',
          vatNumber: editingSupplier.vatNumber ?? '',
          siret: editingSupplier.siret ?? '',
          isActive: editingSupplier.isActive,
        } : undefined}
      />
    </div>
  );
}
