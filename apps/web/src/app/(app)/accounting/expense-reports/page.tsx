'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expenseReportsApi } from '@/lib/api/accounting';
import {
  EXPENSE_REPORT_STATUS_LABELS,
  EXPENSE_REPORT_STATUS_COLORS,
  type ExpenseReportStatus,
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
import { Receipt, Plus, MoreHorizontal, Search, Euro, Clock } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { ExpenseFormDialog } from './expense-form-dialog';
import { ApproveDialog } from './approve-dialog';

function formatCurrency(value: number) {
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €';
}

export default function ExpenseReportsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<any>(null);
  const [approveReport, setApproveReport] = useState<any>(null);
  const debouncedSearch = useDebounce(search, 300);
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ['expense-reports', 'stats'],
    queryFn: () => expenseReportsApi.getStats(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['expense-reports', 'list', { search: debouncedSearch, page }],
    queryFn: () => expenseReportsApi.list({ search: debouncedSearch || undefined, page, limit: 20 }),
  });

  const reimburseMutation = useMutation({
    mutationFn: (id: string) => expenseReportsApi.reimburse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
    },
  });

  const statsItems = [
    { label: 'Total notes', value: stats?.total ?? '—', icon: Receipt },
    { label: 'En attente', value: stats?.pendingApproval ?? '—', icon: Clock },
    { label: 'Montant total', value: stats ? formatCurrency(stats.totalAmount) : '—', icon: Euro },
    { label: 'À approuver', value: stats?.pendingApproval ?? '—', icon: Receipt },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notes de frais</h1>
        <Button onClick={() => { setEditingReport(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Nouvelle note de frais
        </Button>
      </div>

      <StatsBar stats={statsItems} />

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
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
              <TableHead>Titre</TableHead>
              <TableHead>Employé</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Approbateur</TableHead>
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
                  Aucune note de frais trouvée
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((report: any) => {
                const statusColor = EXPENSE_REPORT_STATUS_COLORS[report.status as ExpenseReportStatus];
                const statusLabel = EXPENSE_REPORT_STATUS_LABELS[report.status as ExpenseReportStatus] ?? report.status;
                return (
                  <TableRow key={report.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{report.title}</TableCell>
                    <TableCell>
                      {report.employee
                        ? `${report.employee.firstName} ${report.employee.lastName}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(report.amount))}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(report.expenseDate).toLocaleDateString('fr-FR')}
                    </TableCell>
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
                    <TableCell className="text-muted-foreground">
                      {report.approver
                        ? `${report.approver.firstName} ${report.approver.lastName}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {report.status === 'en_attente' && (
                            <>
                              <DropdownMenuItem onClick={() => {
                                setEditingReport(report);
                                setDialogOpen(true);
                              }}>
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setApproveReport(report)}>
                                Approuver / Refuser
                              </DropdownMenuItem>
                            </>
                          )}
                          {report.status === 'approuve' && (
                            <DropdownMenuItem
                              onClick={() => reimburseMutation.mutate(report.id)}
                              disabled={reimburseMutation.isPending}
                            >
                              Marquer remboursé
                            </DropdownMenuItem>
                          )}
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
          <span>{data.total} notes au total</span>
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

      <ExpenseFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        reportId={editingReport?.id}
        defaultValues={editingReport ? {
          title: editingReport.title,
          description: editingReport.description ?? '',
          amount: Number(editingReport.amount),
          vatAmount: editingReport.vatAmount ? Number(editingReport.vatAmount) : undefined,
          expenseDate: editingReport.expenseDate?.split('T')[0] ?? '',
        } : undefined}
      />

      {approveReport && (
        <ApproveDialog
          open={!!approveReport}
          onOpenChange={(open) => { if (!open) setApproveReport(null); }}
          reportId={approveReport.id}
          reportTitle={approveReport.title}
          employeeName={
            approveReport.employee
              ? `${approveReport.employee.firstName} ${approveReport.employee.lastName}`
              : ''
          }
          amount={Number(approveReport.amount)}
        />
      )}
    </div>
  );
}
