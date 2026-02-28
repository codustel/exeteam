'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clientsApi, type ClientListItem } from '@/lib/api/clients';
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
import { Building2, Plus, MoreHorizontal, Search, Users, MapPin, FolderKanban } from 'lucide-react';
import Link from 'next/link';
import { useDebounce } from '@/hooks/use-debounce';
import { ClientFormDialog } from './client-form-dialog';

export function ClientsTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data: stats } = useQuery({
    queryKey: ['clients', 'stats'],
    queryFn: () => clientsApi.getStats(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['clients', 'list', { search: debouncedSearch, page }],
    queryFn: () => clientsApi.list({ search: debouncedSearch || undefined, page, limit: 20 }),
  });

  const statsItems = [
    { label: 'Total clients', value: stats?.total ?? '—', icon: Building2 },
    { label: 'Actifs', value: stats?.active ?? '—', icon: Building2 },
    { label: 'Inactifs', value: stats?.inactive ?? '—', icon: Building2 },
    { label: 'Avec projets', value: stats?.withProjects ?? '—', icon: FolderKanban },
  ];

  return (
    <div className="space-y-4">
      <StatsBar items={statsItems} />

      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un client..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau client
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Opérateurs</TableHead>
              <TableHead>Sites</TableHead>
              <TableHead>Projets</TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead>Tags</TableHead>
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
                  Aucun client trouvé
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((client: ClientListItem) => (
                <TableRow key={client.id} className="hover:bg-muted/50">
                  <TableCell>
                    <Link href={`/clients/${client.id}`} className="flex items-center gap-3 font-medium hover:text-primary">
                      {client.logoUrl ? (
                        <img src={client.logoUrl} alt={client.name} className="w-8 h-8 rounded object-contain" />
                      ) : (
                        <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <div>{client.name}</div>
                        {client.legalName && client.legalName !== client.name && (
                          <div className="text-xs text-muted-foreground">{client.legalName}</div>
                        )}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{client.city ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {client.operators.slice(0, 3).map(({ operator }) => (
                        <Badge key={operator.id} variant="outline" className="text-xs">
                          {operator.name}
                        </Badge>
                      ))}
                      {client.operators.length > 3 && (
                        <Badge variant="outline" className="text-xs">+{client.operators.length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-sm">
                      <MapPin className="h-3 w-3" /> {client._count.sites}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-sm">
                      <FolderKanban className="h-3 w-3" /> {client._count.projects}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-sm">
                      <Users className="h-3 w-3" /> {client._count.interlocuteurs}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {client.tags.slice(0, 2).map(({ tag }) => (
                        <Badge
                          key={tag.id}
                          style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '40' }}
                          variant="outline"
                          className="text-xs"
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={client.isActive ? 'default' : 'secondary'}>
                      {client.isActive ? 'Actif' : 'Inactif'}
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
                          <Link href={`/clients/${client.id}`}>Voir le détail</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/clients/${client.id}?tab=edit`}>Modifier</Link>
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
          <span>{data.total} clients au total</span>
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

      <ClientFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
