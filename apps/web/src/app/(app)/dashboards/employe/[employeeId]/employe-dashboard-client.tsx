'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import { dashboardApi } from '@/lib/api/dashboard';
import { KPICard } from '@/components/dashboard/KPICard';
import { ChartCard } from '@/components/dashboard/ChartCard';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

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

interface Props {
  employeeId: string;
}

export function EmployeDashboardClient({ employeeId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'employe', employeeId],
    queryFn: () => dashboardApi.getEmployee(employeeId),
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
        href={`/employees/${employeeId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Retour à l&apos;employé
      </Link>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard label="Tâches assignées" value={data.tasksAssigned} />
        <KPICard label="Tâches terminées" value={data.tasksCompleted} />
        <KPICard
          label="Rendement moyen"
          value={`${data.rendementMoyen.toFixed(1)}%`}
        />
        <KPICard label="Heures ce mois" value={`${data.hoursLogged.toFixed(1)} h`} />
      </div>

      {/* Congés restants */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Congés restants :</span>
        <Badge
          className="text-base px-3 py-1"
          style={{ backgroundColor: '#FF6600', color: 'white' }}
        >
          {data.congesRestants} j
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rendement par semaine — Line */}
        <ChartCard title="Rendement par semaine (8 semaines)">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={data.rendementByWeek}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Rendement']} />
              <Line
                type="monotone"
                dataKey="rendement"
                name="Rendement"
                stroke="#FF6600"
                strokeWidth={2}
                dot={{ r: 3, fill: '#FF6600' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Tâches par statut — Donut */}
        <ChartCard title="Tâches par statut">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data.tasksByStatus.map((d) => ({
                  name: TASK_STATUS_LABELS[d.status] ?? d.status,
                  value: d.count,
                }))}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
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
      </div>

      {/* Upcoming leaves */}
      {data.upcomingLeaves.length > 0 && (
        <ChartCard title="Congés à venir">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Du</TableHead>
                <TableHead>Au</TableHead>
                <TableHead className="text-right">Durée</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.upcomingLeaves.map((leave, idx) => {
                const start = new Date(leave.startDate);
                const end = new Date(leave.endDate);
                const days = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
                return (
                  <TableRow key={idx}>
                    <TableCell>
                      <Badge variant="outline">{leave.type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {start.toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-sm">
                      {end.toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-right text-sm">{days} j</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ChartCard>
      )}
    </div>
  );
}
