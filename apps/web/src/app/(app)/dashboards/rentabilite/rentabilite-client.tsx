'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api/dashboard';
import type { RentabiliteEmployee } from '@/lib/api/dashboard';
import { KPICard } from '@/components/dashboard/KPICard';
import { ChartCard } from '@/components/dashboard/ChartCard';
import { ExportButton } from '@/components/dashboard/ExportButton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

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

function ratioClass(ratio: number): string {
  if (ratio >= 1.2) return 'text-green-700 font-semibold';
  if (ratio >= 0.8) return 'text-yellow-600 font-semibold';
  return 'text-red-600 font-semibold';
}

function ratioBg(ratio: number): string {
  if (ratio >= 1.2) return 'bg-green-50';
  if (ratio >= 0.8) return 'bg-yellow-50';
  return 'bg-red-50';
}

export function RentabiliteClient() {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'rentabilite', { year, month }],
    queryFn: () => dashboardApi.getRentabilite({ year: Number(year), month: Number(month) }),
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
        <ExportButton type="rentabilite" />
      </div>

      {/* Summary KPIs */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <KPICard label="Masse salariale chargée" value={formatEUR(data.totals.masseSalariale)} />
          <KPICard label="Revenu généré" value={formatEUR(data.totals.revenueTotal)} />
          <KPICard
            label="Ratio global"
            value={data.totals.ratioGlobal.toFixed(2)}
            valueClassName={ratioClass(data.totals.ratioGlobal)}
          />
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
          Ratio &ge; 1.2 (rentable)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-yellow-400" />
          0.8 – 1.19 (acceptable)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
          &lt; 0.8 (déficitaire)
        </span>
      </div>

      {/* DataTable */}
      <ChartCard title="Détail par employé">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead className="text-right">Salaire chargé</TableHead>
                <TableHead className="text-right">Revenu généré</TableHead>
                <TableHead className="text-right">Ratio</TableHead>
                <TableHead className="text-right">Heures</TableHead>
                <TableHead className="text-right">Taux occupation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              )}
              {data?.employees.map((emp: RentabiliteEmployee) => (
                <TableRow key={emp.employeeId} className={cn('', ratioBg(emp.ratio))}>
                  <TableCell className="font-medium">{emp.employeeName}</TableCell>
                  <TableCell className="text-right text-sm">
                    {formatEUR(emp.salaireCharge)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatEUR(emp.revenueGenere)}
                  </TableCell>
                  <TableCell className={cn('text-right', ratioClass(emp.ratio))}>
                    {emp.ratio.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {emp.hoursLogged.toFixed(1)} h
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {emp.tauxOccupation.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals row */}
              {data && (
                <TableRow className="border-t-2 font-semibold bg-muted/30">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right">
                    {formatEUR(data.totals.masseSalariale)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatEUR(data.totals.revenueTotal)}
                  </TableCell>
                  <TableCell className={cn('text-right', ratioClass(data.totals.ratioGlobal))}>
                    {data.totals.ratioGlobal.toFixed(2)}
                  </TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </ChartCard>
    </div>
  );
}
