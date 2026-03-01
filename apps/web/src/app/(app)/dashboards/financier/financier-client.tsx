'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { dashboardApi } from '@/lib/api/dashboard';
import { KPICard } from '@/components/dashboard/KPICard';
import { ChartCard } from '@/components/dashboard/ChartCard';
import { ExportButton } from '@/components/dashboard/ExportButton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const INVOICE_STATUS_COLORS: Record<string, string> = {
  brouillon: '#94a3b8',
  envoyee: '#3b82f6',
  en_attente: '#f97316',
  payee: '#22c55e',
  en_retard: '#ef4444',
  annulee: '#6b7280',
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  envoyee: 'Envoyée',
  en_attente: 'En attente',
  payee: 'Payée',
  en_retard: 'En retard',
  annulee: 'Annulée',
};

const MONTHS = [
  { value: '1', label: 'Janvier' }, { value: '2', label: 'Février' },
  { value: '3', label: 'Mars' }, { value: '4', label: 'Avril' },
  { value: '5', label: 'Mai' }, { value: '6', label: 'Juin' },
  { value: '7', label: 'Juillet' }, { value: '8', label: 'Août' },
  { value: '9', label: 'Septembre' }, { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' }, { value: '12', label: 'Décembre' },
];

function formatEUR(value: number) {
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export function FinancierClient() {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'financier', { year, month }],
    queryFn: () => dashboardApi.getFinancier({ year: Number(year), month: Number(month) }),
    staleTime: 5 * 60 * 1000,
  });

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i));

  return (
    <div className="p-6 space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Mois" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Année" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ExportButton type="financier" />
      </div>

      {/* KPIs */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KPICard label="CA HT" value={formatEUR(data.chiffreAffaireHT)} />
          <KPICard label="Achats HT" value={formatEUR(data.totalAchatsHT)} />
          <KPICard
            label="Marge brute"
            value={formatEUR(data.margeGrossiere)}
            valueClassName={data.margeGrossiere >= 0 ? 'text-green-700' : 'text-red-600'}
          />
          <KPICard
            label="Factures en attente"
            value={data.invoicesByStatus.find((s) => s.status === 'en_attente')?.count ?? 0}
            valueClassName="text-orange-600"
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CA vs Achats par mois — Grouped Bar */}
        <ChartCard title="CA vs Achats par mois (12 mois)" className="md:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={data?.revenueByMonth ?? []}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => formatEUR(value)} />
              <Legend />
              <Bar dataKey="CA" name="CA HT" fill="#FF6600" radius={[4, 4, 0, 0]} />
              <Bar dataKey="achats" name="Achats HT" fill="#94a3b8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Factures par statut — Pie */}
        <ChartCard title="Factures par statut">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={(data?.invoicesByStatus ?? []).map((d) => ({
                  name: INVOICE_STATUS_LABELS[d.status] ?? d.status,
                  value: d.count,
                }))}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {(data?.invoicesByStatus ?? []).map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={INVOICE_STATUS_COLORS[entry.status] ?? '#cbd5e1'}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top 5 clients — Bar */}
        <ChartCard title="Top 5 clients (CA HT)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              layout="vertical"
              data={(data?.topClients ?? []).map((c) => ({
                name: c.clientName,
                'CA HT': c.totalHT,
              }))}
              margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
              <Tooltip formatter={(value: number) => formatEUR(value)} />
              <Bar dataKey="CA HT" fill="#FF6600" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Factures en retard de paiement */}
      {data && data.pendingInvoices.length > 0 && (
        <ChartCard title="Factures en retard de paiement">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Montant HT</TableHead>
                  <TableHead className="text-right">Échéance</TableHead>
                  <TableHead className="text-right">Retard</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pendingInvoices.map((inv) => {
                  const due = new Date(inv.dueDate);
                  const daysPast = Math.floor((Date.now() - due.getTime()) / 86400000);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.clientName}</TableCell>
                      <TableCell className="text-right">{formatEUR(inv.amount)}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {due.toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">{daysPast} j</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
