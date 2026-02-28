'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { sitesApi, type SiteListItem } from '@/lib/api/sites';
import { StatsBar } from '@exeteam/ui';
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
import { MapPin, Plus, MoreHorizontal, Search, CheckSquare, Activity } from 'lucide-react';
import Link from 'next/link';
import { useDebounce } from '@/hooks/use-debounce';
import { SiteFormDialog } from './site-form-dialog';

export function SitesTable() {
  const searchParams = useSearchParams();
  const prefilterClientId = searchParams.get('clientId') ?? undefined;

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [typologieId, setTypologieId] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data: stats } = useQuery({
    queryKey: ['sites', 'stats'],
    queryFn: () => sitesApi.getStats(),
  });

  const { data: typologies = [] } = useQuery({
    queryKey: ['sites', 'typologies'],
    queryFn: () => sitesApi.getTypologies(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['sites', 'list', { search: debouncedSearch, page, typologieId, clientId: prefilterClientId }],
    queryFn: () => sitesApi.list({
      search: debouncedSearch || undefined,
      page,
      limit: 20,
      typologieId: typologieId || undefined,
      clientId: prefilterClientId,
    }),
  });

  const statsItems = [
    { label: 'Sites actifs', value: stats?.active ?? '—', icon: MapPin },
    { label: 'Inactifs', value: stats?.inactive ?? '—', icon: MapPin },
    { label: 'Tâches en cours', value: stats?.withActiveTasks ?? '—', icon: CheckSquare },
    { label: 'Total', value: stats?.total ?? '—', icon: Activity },
  ];

  return (
    <div className="space-y-4">
      <StatsBar stats={statsItems} />

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Référence, nom, commune..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={typologieId} onValueChange={(v) => { setTypologieId(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Toutes typologies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes typologies</SelectItem>
            {typologies.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setCreateOpen(true)} className="ml-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nouveau site
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Commune</TableHead>
              <TableHead>Dépt</TableHead>
              <TableHead>Opérateur</TableHead>
              <TableHead>Typologie</TableHead>
              <TableHead>Tâches</TableHead>
              <TableHead>GPS</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Chargement...</TableCell>
              </TableRow>
            ) : data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Aucun site trouvé</TableCell>
              </TableRow>
            ) : (
              data?.data.map((site: SiteListItem) => (
                <TableRow key={site.id} className="hover:bg-muted/50">
                  <TableCell>
                    <Link href={`/sites/${site.id}`} className="font-mono text-sm font-medium hover:text-primary">
                      {site.reference}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{site.name}</TableCell>
                  <TableCell>
                    <Link href={`/clients/${site.client.id}`} className="text-sm hover:text-primary">
                      {site.client.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{site.commune ?? '—'}</TableCell>
                  <TableCell className="text-sm">{site.departement ?? '—'}</TableCell>
                  <TableCell className="text-sm">{site.operator?.name ?? '—'}</TableCell>
                  <TableCell>
                    {site.typologie && (
                      <Badge variant="outline" className="text-xs">{site.typologie.name}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-sm">
                      <CheckSquare className="h-3 w-3" /> {site._count.tasks}
                    </span>
                  </TableCell>
                  <TableCell>
                    {site.latitude && site.longitude ? (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                        <MapPin className="h-3 w-3 mr-1" />
                        GPS
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={site.isActive ? 'default' : 'secondary'}>
                      {site.isActive ? 'Actif' : 'Inactif'}
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
                        <DropdownMenuItem asChild>
                          <Link href={`/sites/${site.id}`}>Voir le détail</Link>
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
          <span>{data.total} sites au total</span>
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

      <SiteFormDialog open={createOpen} onOpenChange={setCreateOpen} defaultClientId={prefilterClientId} />
    </div>
  );
}
