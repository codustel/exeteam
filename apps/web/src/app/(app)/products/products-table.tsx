'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Search, MoreHorizontal } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { ProductFormDialog } from './product-form-dialog';

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  etude: 'Étude',
  plan: 'Plan',
  note_calcul: 'Note de calcul',
  releve: 'Relevé',
  doe: 'DOE',
  apd: 'APD',
  pdb: 'PDB',
  maj: 'Mise à jour',
  autre: 'Autre',
};

const UNIT_TYPE_LABELS: Record<string, string> = {
  piece: 'Pièce',
  heure: 'Heure',
  forfait: 'Forfait',
  ml: 'ml',
  m2: 'm²',
};

export function ProductsTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [clientId, setClientId] = useState('');
  const [productType, setProductType] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ['clients', 'all'],
    queryFn: () => apiRequest<any>('/clients?limit=200').then((r: any) => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['codes-produits', { search: debouncedSearch, page, clientId, productType }],
    queryFn: () => apiRequest<any>(`/codes-produits?${new URLSearchParams(
      Object.fromEntries(
        Object.entries({ search: debouncedSearch || undefined, page, limit: 50, clientId: clientId || undefined, productType: productType || undefined, isActive: true })
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )
    )}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Code, désignation..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={clientId} onValueChange={(v) => { setClientId(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tous clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous clients</SelectItem>
            {clients.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={productType} onValueChange={(v) => { setProductType(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tous types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            {Object.entries(PRODUCT_TYPE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setCreateOpen(true)} className="ml-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nouveau code produit
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Désignation</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Unité</TableHead>
              <TableHead>Prix unitaire</TableHead>
              <TableHead>Gamme (h)</TableHead>
              <TableHead>Tâches</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Chargement...</TableCell>
              </TableRow>
            ) : data?.data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Aucun code produit
                </TableCell>
              </TableRow>
            ) : (
              data?.data?.map((cp: any) => (
                <TableRow key={cp.id} className="hover:bg-muted/50">
                  <TableCell className="font-mono font-medium text-sm">{cp.code}</TableCell>
                  <TableCell>{cp.designation}</TableCell>
                  <TableCell className="text-sm">{cp.client?.name}</TableCell>
                  <TableCell>
                    {cp.productType && (
                      <Badge variant="outline" className="text-xs">
                        {PRODUCT_TYPE_LABELS[cp.productType] ?? cp.productType}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{cp.unitType ? UNIT_TYPE_LABELS[cp.unitType] ?? cp.unitType : '—'}</TableCell>
                  <TableCell className="font-medium">
                    {Number(cp.unitPrice).toFixed(2)} {cp.currency?.symbol ?? '€'}
                  </TableCell>
                  <TableCell className="text-sm">{cp.timeGamme ? Number(cp.timeGamme).toFixed(2) : '—'}</TableCell>
                  <TableCell className="text-sm">{cp._count?.tasks ?? 0}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Modifier</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Désactiver</DropdownMenuItem>
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
          <span>{data.total} codes produits</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Précédent</Button>
            <span className="px-3 flex items-center">Page {page} / {data.pages}</span>
            <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Suivant</Button>
          </div>
        </div>
      )}

      <ProductFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
