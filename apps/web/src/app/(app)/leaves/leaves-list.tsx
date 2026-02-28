'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Check, X, Calendar } from 'lucide-react';
import { LeaveFormDialog } from './leave-form-dialog';

const STATUS_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  approuve: 'Approuvé',
  refuse: 'Refusé',
  annule: 'Annulé',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  en_attente: 'outline',
  approuve: 'default',
  refuse: 'destructive',
  annule: 'secondary',
};

export function LeavesList() {
  const searchParams = useSearchParams();
  const prefilterEmployeeId = searchParams.get('employeeId') ?? undefined;

  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<any>({
    queryKey: ['leaves', 'list', { status, page, employeeId: prefilterEmployeeId }],
    queryFn: () => apiRequest<any>(`/leaves?${new URLSearchParams(
      Object.fromEntries(
        Object.entries({ page, limit: 20, status: status || undefined, employeeId: prefilterEmployeeId })
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )
    )}`),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/leaves/${id}/approve`, { method: 'PATCH', body: JSON.stringify({}) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaves'] }),
  });

  const refuseMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/leaves/${id}/refuse`, { method: 'PATCH', body: JSON.stringify({}) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaves'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Select value={status} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tous statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle demande
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Chargement...</div>
      ) : data?.data?.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
          <Calendar className="h-8 w-8 mx-auto mb-2" />
          <p>Aucune demande de congé</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.data?.map((leave: any) => (
            <Card key={leave.id}>
              <CardContent className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-medium">{leave.employee?.firstName} {leave.employee?.lastName}</p>
                    <p className="text-sm text-muted-foreground">
                      {leave.leaveType?.name} · {new Date(leave.startDate).toLocaleDateString('fr-FR')} → {new Date(leave.endDate).toLocaleDateString('fr-FR')}
                      · {Number(leave.days)} jour(s)
                    </p>
                    {leave.reason && <p className="text-xs text-muted-foreground mt-0.5">Motif: {leave.reason}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={STATUS_VARIANTS[leave.status] ?? 'outline'}>
                    {STATUS_LABELS[leave.status] ?? leave.status}
                  </Badge>
                  {leave.status === 'en_attente' && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="default" className="h-8 w-8" onClick={() => approveMutation.mutate(leave.id)} title="Approuver">
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => refuseMutation.mutate(leave.id)} title="Refuser">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{data.total} demandes</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Précédent</Button>
            <span className="px-3 flex items-center">Page {page} / {data.pages}</span>
            <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Suivant</Button>
          </div>
        </div>
      )}

      <LeaveFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
