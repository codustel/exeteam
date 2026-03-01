'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ImportEntityType, ImportJobStatus } from '@exeteam/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { listImportJobs } from '@/lib/api/import';
import type { ImportJobDto } from '@/lib/api/import';

function statusBadge(status: string) {
  switch (status) {
    case 'done':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Terminé</Badge>;
    case 'failed':
      return <Badge variant="destructive">Échec</Badge>;
    case 'processing':
      return <Badge variant="secondary">En cours</Badge>;
    case 'pending':
      return <Badge variant="outline">En attente</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

const ENTITY_LABELS: Record<string, string> = {
  clients: 'Clients',
  employees: 'Employés',
  sites: 'Sites',
  tasks: 'Tâches',
  'purchase-invoices': "Factures d'achat",
};

export function RecentImports() {
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['importJobs', page, entityFilter, statusFilter],
    queryFn: () =>
      listImportJobs({
        page,
        limit: 10,
        entityType: (entityFilter as ImportEntityType) || undefined,
        status: (statusFilter as ImportJobStatus) || undefined,
      }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold">Imports récents</h2>
        <div className="ml-auto flex items-center gap-2">
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue placeholder="Toutes les entités" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Toutes les entités</SelectItem>
              {Object.entries(ENTITY_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tous les statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="processing">En cours</SelectItem>
              <SelectItem value="done">Terminé</SelectItem>
              <SelectItem value="failed">Échec</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Entité</TableHead>
              <TableHead>Fichier</TableHead>
              <TableHead className="text-right">Lignes</TableHead>
              <TableHead className="text-right">Erreurs</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : data?.data.map((job: ImportJobDto) => (
                  <TableRow key={job.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDate(job.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ENTITY_LABELS[job.entityType] ?? job.entityType}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate" title={job.fileName}>
                      {job.fileName}
                    </TableCell>
                    <TableCell className="text-sm text-right">{job.totalRows}</TableCell>
                    <TableCell className="text-sm text-right">
                      {job.errorRows > 0 ? (
                        <span className="text-destructive font-medium">{job.errorRows}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>{statusBadge(job.status)}</TableCell>
                  </TableRow>
                ))}

            {!isLoading && data?.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Aucun import
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {(page - 1) * 10 + 1}–{Math.min(page * 10, data.total)} sur {data.total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              disabled={page >= data.pages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
