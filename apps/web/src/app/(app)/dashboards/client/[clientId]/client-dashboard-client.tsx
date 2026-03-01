'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { dashboardApi } from '@/lib/api/dashboard';
import { KPICard } from '@/components/dashboard/KPICard';
import { ChartCard } from '@/components/dashboard/ChartCard';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';

const TASK_STATUS_COLORS: Record<string, string> = {
  a_traiter: '#94a3b8',
  en_cours: '#3b82f6',
  en_revision: '#a855f7',
  terminee: '#22c55e',
  livree: '#10b981',
  annulee: '#ef4444',
};

const TASK_STATUS_LABELS: Record<string, string> = {
  a_traiter: 'À traiter',
  en_cours: 'En cours',
  en_revision: 'En révision',
  terminee: 'Terminée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  a_traiter: 'secondary',
  en_cours: 'default',
  en_revision: 'outline',
  terminee: 'default',
  livree: 'default',
  annulee: 'destructive',
};

interface Props {
  clientId: string;
}

export function ClientDashboardClient({ clientId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'client', clientId],
    queryFn: () => dashboardApi.getClient(clientId),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !data) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-muted-foreground">
        Chargement...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Link
        href={`/clients/${clientId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Retour au client
      </Link>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard label="Projets" value={data.projects.total} />
        <KPICard label="Tâches en cours" value={data.tasks.enCours} />
        <KPICard label="Tâches terminées" value={data.tasks.terminees} />
        <KPICard label="Sites" value={data.sites.total} />
      </div>

      {/* Last activity */}
      {data.lastActivity && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          Dernière activité :{' '}
          {new Date(data.lastActivity).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'long', year: 'numeric',
          })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tâches par statut — Donut */}
        <ChartCard title="Tâches par statut">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data.tasksByStatus.map((d) => ({
                  name: TASK_STATUS_LABELS[d.status] ?? d.status,
                  value: d.count,
                }))}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={2}
                dataKey="value"
              >
                {data.tasksByStatus.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={TASK_STATUS_COLORS[entry.status] ?? '#cbd5e1'}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Recent tasks */}
        <ChartCard title="Tâches récentes">
          <div className="overflow-auto max-h-64">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Mise à jour</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium text-sm">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="hover:text-[#FF6600] hover:underline"
                      >
                        {task.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE_VARIANT[task.status] ?? 'secondary'}>
                        {TASK_STATUS_LABELS[task.status] ?? task.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(task.updatedAt).toLocaleDateString('fr-FR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
