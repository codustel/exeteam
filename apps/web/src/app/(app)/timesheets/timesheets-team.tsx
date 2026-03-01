'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeEntriesApi, type TeamTimesheetResponse } from '@/lib/api/time-entries';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function addWeeks(dateStr: string, weeks: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split('T')[0];
}

function formatWeekRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${s.toLocaleDateString('fr-FR', opts)} — ${e.toLocaleDateString('fr-FR', { ...opts, year: 'numeric' })}`;
}

export function TimesheetsTeam() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data: timesheet, isLoading } = useQuery({
    queryKey: ['timesheet-team', weekStart],
    queryFn: () => timeEntriesApi.getTeam(weekStart),
  });

  const validateMutation = useMutation({
    mutationFn: (ids: string[]) => timeEntriesApi.bulkValidate(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet-team'] });
      setSelected(new Set());
    },
  });

  const handleSelectAll = () => {
    if (!timesheet) return;
    const allPendingIds = timesheet.subordinates.flatMap((s) => s.pendingEntryIds);
    if (selected.size === allPendingIds.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allPendingIds));
    }
  };

  const handleSelectEmployee = (ids: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleValidateSelected = () => {
    if (selected.size === 0) return;
    validateMutation.mutate(Array.from(selected));
  };

  const allPendingIds = timesheet?.subordinates.flatMap((s) => s.pendingEntryIds) ?? [];

  return (
    <div className="space-y-4">
      {/* Navigation + tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(getMonday(new Date()))}>
            Aujourd&apos;hui
          </Button>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium ml-2">
            {timesheet ? formatWeekRange(timesheet.weekStart, timesheet.weekEnd) : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button
              size="sm"
              onClick={handleValidateSelected}
              disabled={validateMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Valider la sélection ({selected.size})
            </Button>
          )}
          <div className="flex rounded-md border">
            <Link
              href="/timesheets"
              className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent rounded-l-md"
            >
              Semaine
            </Link>
            <Link
              href="/timesheets/monthly"
              className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent rounded-none border-l"
            >
              Mois
            </Link>
            <Link
              href="/timesheets/team"
              className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-r-md border-l"
            >
              Équipe
            </Link>
          </div>
        </div>
      </div>

      {/* Team table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : !timesheet || timesheet.subordinates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Aucun collaborateur trouvé.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 w-10">
                  <Checkbox
                    checked={allPendingIds.length > 0 && selected.size === allPendingIds.length}
                    onCheckedChange={handleSelectAll}
                    disabled={allPendingIds.length === 0}
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium">Employé</th>
                <th className="text-center px-4 py-3 font-medium">Heures saisies</th>
                <th className="text-center px-4 py-3 font-medium">Heures attendues</th>
                <th className="text-center px-4 py-3 font-medium">Taux</th>
                <th className="text-center px-4 py-3 font-medium">Validées</th>
                <th className="text-center px-4 py-3 font-medium">En attente</th>
              </tr>
            </thead>
            <tbody>
              {timesheet.subordinates.map((sub) => (
                <tr key={sub.employeeId} className="border-b hover:bg-accent/30">
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={sub.pendingEntryIds.every((id) => selected.has(id))}
                      onCheckedChange={() => handleSelectEmployee(sub.pendingEntryIds)}
                      disabled={sub.pendingCount === 0}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-xs font-bold">
                        {sub.firstName[0]}{sub.lastName[0]}
                      </div>
                      <span className="font-medium">{sub.firstName} {sub.lastName}</span>
                    </div>
                  </td>
                  <td className="text-center px-4 py-3 font-medium">
                    {sub.totalHours.toFixed(1)}h
                  </td>
                  <td className="text-center px-4 py-3 text-muted-foreground">
                    {sub.expectedHours.toFixed(1)}h
                  </td>
                  <td className="text-center px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                      sub.occupationRate >= 90 && 'bg-green-100 text-green-700',
                      sub.occupationRate >= 70 && sub.occupationRate < 90 && 'bg-yellow-100 text-yellow-700',
                      sub.occupationRate < 70 && 'bg-red-100 text-red-700',
                    )}>
                      {sub.occupationRate}%
                    </span>
                  </td>
                  <td className="text-center px-4 py-3 text-green-600 font-medium">
                    {sub.validatedCount}
                  </td>
                  <td className="text-center px-4 py-3">
                    {sub.pendingCount > 0 ? (
                      <span className="text-orange-600 font-medium">{sub.pendingCount}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 font-medium">
                <td className="px-4 py-3" colSpan={2}>Total équipe</td>
                <td className="text-center px-4 py-3">{timesheet.teamTotal.toFixed(1)}h</td>
                <td className="text-center px-4 py-3">{timesheet.teamExpected.toFixed(1)}h</td>
                <td className="text-center px-4 py-3">
                  {timesheet.teamExpected > 0
                    ? `${Math.round((timesheet.teamTotal / timesheet.teamExpected) * 100)}%`
                    : '—'}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
