'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Props { clientId: string }

export function SitesTab({ clientId }: Props) {
  const { data: sites = [], isLoading } = useQuery<any[]>({
    queryKey: ['sites', 'by-client', clientId],
    queryFn: () => apiRequest<any[]>(`/sites?clientId=${clientId}&limit=100`).then((r: any) => r.data ?? r),
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Chargement...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Sites ({sites.length})</h3>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/sites?clientId=${clientId}`}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Voir tous les sites
          </Link>
        </Button>
      </div>

      {sites.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Aucun site pour ce client</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Commune</TableHead>
              <TableHead>Typologie</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sites.map((site: any) => (
              <TableRow key={site.id}>
                <TableCell>
                  <Link href={`/sites/${site.id}`} className="font-mono text-sm hover:text-primary">
                    {site.reference}
                  </Link>
                </TableCell>
                <TableCell>{site.name}</TableCell>
                <TableCell>{site.commune ?? '—'}</TableCell>
                <TableCell>{site.typologie?.name ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={site.isActive ? 'default' : 'secondary'}>
                    {site.isActive ? 'Actif' : 'Inactif'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
