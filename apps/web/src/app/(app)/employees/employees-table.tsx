'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { StatsBar } from '@exeteam/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Search, MoreHorizontal, Users, UserCheck, Calendar, Activity } from 'lucide-react';
import Link from 'next/link';
import { useDebounce } from '@/hooks/use-debounce';
import { EmployeeFormDialog } from './employee-form-dialog';

const CONTRACT_LABELS: Record<string, string> = {
  cdi: 'CDI', cdd: 'CDD', stage: 'Stage', freelance: 'Freelance', alternance: 'Alternance',
};

export function EmployeesTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data: stats } = useQuery<any>({
    queryKey: ['employees', 'stats'],
    queryFn: () => apiRequest<any>('/employees/stats'),
  });

  const { data, isLoading } = useQuery<any>({
    queryKey: ['employees', 'list', { search: debouncedSearch, page }],
    queryFn: () => apiRequest<any>(`/employees?${new URLSearchParams(
      Object.fromEntries(
        Object.entries({ search: debouncedSearch || undefined, page, limit: 20 })
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )
    )}`),
  });

  const statsItems = [
    { label: 'Effectif total', value: stats?.active ?? '—', icon: Users },
    { label: 'Taux occupation', value: stats ? `${stats.avgTasksPerEmployee} t/emp` : '—', icon: Activity },
    { label: 'En congé', value: stats?.onLeave ?? '—', icon: Calendar },
    { label: 'Inactifs', value: stats?.inactive ?? '—', icon: UserCheck },
  ];

  return (
    <div className="space-y-4">
      <StatsBar stats={statsItems} />
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nom, poste..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvel employé
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employé</TableHead>
              <TableHead>Poste</TableHead>
              <TableHead>Département</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead>Contrat</TableHead>
              <TableHead>Tâches</TableHead>
              <TableHead>Compte</TableHead>
              <TableHead>Statut</TableHead>
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
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucun employé</TableCell>
              </TableRow>
            ) : (
              data?.data?.map((emp: any) => (
                <TableRow key={emp.id} className="hover:bg-muted/50">
                  <TableCell>
                    <Link href={`/employees/${emp.id}`} className="flex items-center gap-3 hover:text-primary">
                      {emp.photoUrl ? (
                        <img src={emp.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                          {emp.firstName[0]}{emp.lastName[0]}
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{emp.firstName} {emp.lastName}</div>
                        {emp.professionalEmail && (
                          <div className="text-xs text-muted-foreground">{emp.professionalEmail}</div>
                        )}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{emp.position ?? '—'}</TableCell>
                  <TableCell className="text-sm">{emp.department?.name ?? '—'}</TableCell>
                  <TableCell className="text-sm">
                    {emp.manager ? (
                      <Link href={`/employees/${emp.manager.id}`} className="hover:text-primary">
                        {emp.manager.firstName} {emp.manager.lastName}
                      </Link>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    {emp.contractType && (
                      <Badge variant="outline" className="text-xs">
                        {CONTRACT_LABELS[emp.contractType] ?? emp.contractType}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{emp._count?.assignedTasks ?? 0}</TableCell>
                  <TableCell>
                    {emp.user ? (
                      <Badge variant={emp.user.isActive ? 'default' : 'secondary'} className="text-xs">Compte actif</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sans compte</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={emp.isActive ? 'default' : 'secondary'}>{emp.isActive ? 'Actif' : 'Inactif'}</Badge>
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
                          <Link href={`/employees/${emp.id}`}>Voir le profil</Link>
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
          <span>{data.total} employés</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Précédent</Button>
            <span className="px-3 flex items-center">Page {page} / {data.pages}</span>
            <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Suivant</Button>
          </div>
        </div>
      )}

      <EmployeeFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
