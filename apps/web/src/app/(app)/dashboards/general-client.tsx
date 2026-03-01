'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { dashboardApi } from '@/lib/api/dashboard';
import { KPICard } from '@/components/dashboard/KPICard';
import { ChartCard } from '@/components/dashboard/ChartCard';
import { ExportButton } from '@/components/dashboard/ExportButton';

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

const PROJECT_STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  a_traiter: 'À traiter',
  en_cours: 'En cours',
  en_revision: 'En révision',
  terminee: 'Terminée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

function formatEUR(value: number) {
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export function GeneralClient() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'general'],
    queryFn: () => dashboardApi.getGeneral(),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !data) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-muted-foreground">
        Chargement du tableau de bord...
      </div>
    );
  }

  const kpis = [
    { label: 'Clients', value: data.clients.total },
    { label: 'Projets en cours', value: data.projects.enCours },
    {
      label: 'Tâches en retard',
      value: data.tasks.enRetard,
      valueClassName: data.tasks.enRetard > 0 ? 'text-red-600' : undefined,
    },
    { label: 'Employés actifs', value: data.employees.actifs },
    { label: 'CA mois (HT)', value: formatEUR(data.revenue.factureEmisHT) },
    { label: 'Rendement moyen', value: `${data.rendementMoyen.toFixed(1)}%` },
  ];

  const employeeDonut = [
    { name: 'Actifs', value: data.employees.actifs, fill: '#22c55e' },
    { name: 'En congé', value: data.employees.enConge, fill: '#f97316' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Toolbar */}
      <div className="flex justify-end">
        <ExportButton type="general" />
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <KPICard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            valueClassName={kpi.valueClassName}
          />
        ))}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tâches par statut — Pie */}
        <ChartCard title="Tâches par statut">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data.tasksByStatus.map((d) => ({
                  name: TASK_STATUS_LABELS[d.status] ?? d.status,
                  value: d.count,
                  fill: TASK_STATUS_COLORS[d.status] ?? '#cbd5e1',
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
              <Tooltip formatter={(value: number) => [value, 'Tâches']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Projets par statut — Bar */}
        <ChartCard title="Projets par statut">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={data.projectsByStatus.map((d) => ({
                name: PROJECT_STATUS_LABELS[d.status] ?? d.status,
                Projets: d.count,
              }))}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="Projets" fill="#FF6600" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Employés — Donut */}
        <ChartCard title="Employés">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={employeeDonut}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
              >
                {employeeDonut.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Activité — Line chart */}
        <ChartCard title="Tâches terminées (8 dernières semaines)">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={data.tasksCompletedByWeek}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="completed"
                name="Terminées"
                stroke="#FF6600"
                strokeWidth={2}
                dot={{ r: 3, fill: '#FF6600' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
