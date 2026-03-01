'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DateRange } from 'react-day-picker';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { dashboardApi } from '@/lib/api/dashboard';
import { KPICard } from '@/components/dashboard/KPICard';
import { ChartCard } from '@/components/dashboard/ChartCard';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import { ExportButton } from '@/components/dashboard/ExportButton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const TASK_STATUS_LABELS: Record<string, string> = {
  a_traiter: 'À traiter',
  en_cours: 'En cours',
  en_revision: 'En révision',
  terminee: 'Terminée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

function rendementColor(r: number): string {
  if (r >= 90) return 'text-green-600 font-semibold';
  if (r >= 70) return 'text-yellow-600 font-semibold';
  return 'text-red-600 font-semibold';
}

export function ProductionClient() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const startDate = dateRange?.from?.toISOString().slice(0, 10);
  const endDate = dateRange?.to?.toISOString().slice(0, 10);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'production', { startDate, endDate }],
    queryFn: () => dashboardApi.getProduction({ startDate, endDate }),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="p-6 space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder="90 derniers jours"
          />
        </div>
        <ExportButton
          type="production"
          startDate={startDate}
          endDate={endDate}
        />
      </div>

      {/* KPIs */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KPICard
            label="Tâches terminées"
            value={data.tasksByStatus
              .filter((d) => ['terminee', 'livree'].includes(d.status))
              .reduce((s, d) => s + d.count, 0)}
          />
          <KPICard
            label="En retard"
            value={data.tasksOverdue}
            valueClassName={data.tasksOverdue > 0 ? 'text-red-600' : undefined}
          />
          <KPICard label="Délai R→L moyen" value={`${data.delaiRLMoyen} j.o.`} />
          <KPICard
            label="Rendement moyen"
            value={`${data.rendementParOperateur.length > 0
              ? (data.rendementParOperateur.reduce((s, o) => s + o.rendement, 0) / data.rendementParOperateur.length).toFixed(1)
              : '—'}%`}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tâches par statut — Horizontal Bar */}
        <ChartCard title="Tâches par statut">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              layout="vertical"
              data={(data?.tasksByStatus ?? []).map((d) => ({
                name: TASK_STATUS_LABELS[d.status] ?? d.status,
                Tâches: d.count,
              }))}
              margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
              <Tooltip />
              <Bar dataKey="Tâches" fill="#FF6600" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Rendement par opérateur — Bar ranked */}
        <ChartCard title="Rendement par opérateur">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={(data?.rendementParOperateur ?? []).map((o) => ({
                name: o.operatorName,
                Rendement: o.rendement,
              }))}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Rendement']} />
              <Bar dataKey="Rendement" fill="#FF6600" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Production par semaine — Line: started vs completed */}
        <ChartCard title="Production par semaine (8 dernières semaines)" className="md:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={data?.productionByWeek ?? []}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="completed"
                name="Terminées"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="started"
                name="Démarrées"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                strokeDasharray="4 2"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top codes produits */}
      {data && data.topCodes.length > 0 && (
        <ChartCard title="Top codes produits">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code produit</TableHead>
                  <TableHead className="text-right">Nb tâches</TableHead>
                  <TableHead className="text-right">Rendement moyen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topCodes.map((row) => (
                  <TableRow key={row.codeProduit}>
                    <TableCell className="font-mono">{row.codeProduit}</TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                    <TableCell className={`text-right ${rendementColor(row.rendementMoyen)}`}>
                      {row.rendementMoyen.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ChartCard>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          Chargement...
        </div>
      )}
    </div>
  );
}
