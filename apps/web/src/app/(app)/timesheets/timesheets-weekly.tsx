'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeEntriesApi, type WeeklyTimesheetResponse } from '@/lib/api/time-entries';
import { employeesApi } from '@/lib/api/employees';
import { Button } from '@/components/ui/button';
import { StatsBar } from '@exeteam/ui';
import { TimesheetEntryCell } from './timesheet-entry-cell';
import { TimesheetExportButton } from './timesheet-export-button';
import { ChevronLeft, ChevronRight, Clock, Target, Percent, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

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

export function TimesheetsWeekly() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const queryClient = useQueryClient();

  const { data: employee } = useQuery({
    queryKey: ['employee-me'],
    queryFn: () => employeesApi.getMe(),
  });

  const { data: timesheet, isLoading } = useQuery({
    queryKey: ['timesheet-weekly', employee?.id, weekStart],
    queryFn: () => timeEntriesApi.getWeekly(employee!.id, weekStart),
    enabled: !!employee?.id,
  });

  const updateMutation = useMutation({
    mutationFn: ({ entryId, hours }: { entryId: string; hours: number }) =>
      timeEntriesApi.update(entryId, { hours }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet-weekly'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: { taskId: string; employeeId: string; date: string; hours: number }) =>
      timeEntriesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet-weekly'] });
    },
  });

  const stats = useMemo(() => {
    if (!timesheet) return [];
    return [
      { label: 'Total heures', value: `${timesheet.weeklyTotal.toFixed(1)}h`, icon: Clock },
      { label: 'Heures attendues', value: `${timesheet.weeklyExpected.toFixed(1)}h`, icon: Target },
      { label: 'Taux occupation', value: `${timesheet.occupationRate}%`, icon: Percent },
      { label: 'Jours de congé', value: timesheet.leaveDays, icon: CalendarDays },
    ];
  }, [timesheet]);

  const handleCellSave = (taskRow: any, dayIndex: number, hours: number) => {
    if (!employee) return;
    const day = timesheet?.days[dayIndex];
    if (!day) return;

    const existingEntry = taskRow.days[dayIndex]?.entries?.[0];
    if (existingEntry) {
      if (hours === 0) {
        // Delete entry
        timeEntriesApi.delete(existingEntry.id).then(() => {
          queryClient.invalidateQueries({ queryKey: ['timesheet-weekly'] });
        });
      } else {
        updateMutation.mutate({ entryId: existingEntry.id, hours });
      }
    } else if (hours > 0) {
      createMutation.mutate({
        taskId: taskRow.taskId,
        employeeId: employee.id,
        date: day.date,
        hours,
      });
    }
  };

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
          <TimesheetExportButton employeeId={employee?.id} weekStart={weekStart} />
          <div className="flex rounded-md border">
            <Link
              href="/timesheets"
              className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-l-md"
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
              className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent rounded-r-md border-l"
            >
              Équipe
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      {timesheet && <StatsBar stats={stats} />}

      {/* Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : !timesheet || timesheet.taskRows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Aucune saisie cette semaine. Les tâches apparaîtront ici dès que vous saisirez des heures.
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2 font-medium min-w-[180px]">Tâche</th>
                <th className="text-left px-2 py-2 font-medium min-w-[120px]">Projet</th>
                {timesheet.days.map((day, i) => (
                  <th
                    key={day.date}
                    className={cn(
                      'text-center px-1 py-2 font-medium w-16',
                      day.isWeekend && 'bg-gray-100',
                      day.isHoliday && 'bg-purple-50',
                      day.isLeave && 'bg-blue-50',
                    )}
                  >
                    <div>{DAY_LABELS[i]}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(day.date).getDate()}
                    </div>
                  </th>
                ))}
                <th className="text-center px-2 py-2 font-medium w-16">Total</th>
              </tr>
            </thead>
            <tbody>
              {timesheet.taskRows.map((row) => (
                <tr key={row.taskId} className="border-b hover:bg-accent/30">
                  <td className="px-4 py-2">
                    <div className="font-medium truncate">{row.taskReference}</div>
                    <div className="text-xs text-muted-foreground truncate">{row.taskTitle}</div>
                  </td>
                  <td className="px-2 py-2 text-muted-foreground truncate">{row.projectName}</td>
                  {timesheet.days.map((day, i) => {
                    const cellHours = row.days[i]?.hours ?? 0;
                    const hasValidated = row.days[i]?.entries?.some((e: any) => e.isValidated);
                    return (
                      <td key={day.date} className="text-center px-1 py-1">
                        <TimesheetEntryCell
                          hours={cellHours}
                          isValidated={!!hasValidated}
                          isLeave={day.isLeave}
                          isHoliday={day.isHoliday}
                          isWeekend={day.isWeekend}
                          conflict={day.isLeave && cellHours > 0}
                          onSave={(hours) => handleCellSave(row, i, hours)}
                        />
                      </td>
                    );
                  })}
                  <td className="text-center px-2 py-2 font-semibold">{row.total.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 font-medium">
                <td className="px-4 py-2" colSpan={2}>Total journalier</td>
                {timesheet.days.map((day) => (
                  <td
                    key={day.date}
                    className={cn(
                      'text-center px-1 py-2',
                      !day.isWeekend && !day.isLeave && !day.isHoliday && day.total < day.expected && 'text-red-600',
                      !day.isWeekend && !day.isLeave && !day.isHoliday && day.total >= day.expected && day.expected > 0 && 'text-green-600',
                    )}
                  >
                    {day.total.toFixed(1)}
                    {!day.isWeekend && !day.isLeave && !day.isHoliday && (
                      <div className="text-xs text-muted-foreground">/{day.expected}</div>
                    )}
                  </td>
                ))}
                <td className="text-center px-2 py-2 font-bold">{timesheet.weeklyTotal.toFixed(1)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
