'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { timeEntriesApi, type MonthlyTimesheetResponse } from '@/lib/api/time-entries';
import { employeesApi } from '@/lib/api/employees';
import { Button } from '@/components/ui/button';
import { StatsBar } from '@exeteam/ui';
import { TimesheetExportButton } from './timesheet-export-button';
import { ChevronLeft, ChevronRight, Clock, Target, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const DAY_HEADERS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const STATUS_COLORS: Record<string, string> = {
  full: 'bg-green-500',
  partial: 'bg-yellow-500',
  missing: 'bg-red-500',
  leave: 'bg-blue-500',
  holiday: 'bg-purple-500',
  weekend: 'bg-gray-300',
};

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

export function TimesheetsMonthly() {
  const [month, setMonth] = useState(getCurrentMonth);
  const router = useRouter();

  const { data: employee } = useQuery({
    queryKey: ['employee-me'],
    queryFn: () => employeesApi.getMe(),
  });

  const { data: timesheet, isLoading } = useQuery({
    queryKey: ['timesheet-monthly', employee?.id, month],
    queryFn: () => timeEntriesApi.getMonthly(employee!.id, month),
    enabled: !!employee?.id,
  });

  const stats = useMemo(() => {
    if (!timesheet) return [];
    return [
      { label: 'Total heures', value: `${timesheet.monthlyTotal.toFixed(1)}h`, icon: Clock },
      { label: 'Heures attendues', value: `${timesheet.monthlyExpected.toFixed(1)}h`, icon: Target },
      { label: 'Taux occupation', value: `${timesheet.occupationRate}%`, icon: Percent },
    ];
  }, [timesheet]);

  // Build calendar grid (rows of weeks)
  const calendarWeeks = useMemo(() => {
    if (!timesheet) return [];
    const weeks: (typeof timesheet.days[0] | null)[][] = [];
    let currentWeek: (typeof timesheet.days[0] | null)[] = [];

    // Pad beginning with nulls
    if (timesheet.days.length > 0) {
      const firstDayOfWeek = timesheet.days[0].dayOfWeek;
      const mondayOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
      for (let i = 0; i < mondayOffset; i++) {
        currentWeek.push(null);
      }
    }

    for (const day of timesheet.days) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // Pad end with nulls
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      weeks.push(currentWeek);
    }

    return weeks;
  }, [timesheet]);

  const handleDayClick = (date: string) => {
    const weekStart = getMonday(new Date(date));
    router.push(`/timesheets?week=${weekStart}`);
  };

  return (
    <div className="space-y-4">
      {/* Navigation + tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(getCurrentMonth())}>
            Aujourd&apos;hui
          </Button>
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium ml-2 capitalize">
            {formatMonth(month)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <TimesheetExportButton employeeId={employee?.id} month={month} />
          <div className="flex rounded-md border">
            <Link
              href="/timesheets"
              className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent rounded-l-md"
            >
              Semaine
            </Link>
            <Link
              href="/timesheets/monthly"
              className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-none border-l"
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

      {/* Calendar Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 bg-muted/50 border-b">
            {DAY_HEADERS.map((d) => (
              <div key={d} className="text-center py-2 text-sm font-medium text-muted-foreground">
                {d}
              </div>
            ))}
          </div>
          {calendarWeeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
              {week.map((day, di) => (
                <div
                  key={di}
                  className={cn(
                    'min-h-[80px] p-2 border-r last:border-r-0 transition-colors',
                    day && !day.isWeekend && 'hover:bg-accent/30 cursor-pointer',
                    !day && 'bg-gray-50',
                    day?.isWeekend && 'bg-gray-50',
                  )}
                  onClick={() => day && !day.isWeekend && handleDayClick(day.date)}
                >
                  {day && (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn(
                          'text-sm font-medium',
                          day.isWeekend && 'text-muted-foreground',
                        )}>
                          {day.dayOfMonth}
                        </span>
                        <span className={cn('w-2.5 h-2.5 rounded-full', STATUS_COLORS[day.status])} />
                      </div>
                      {day.hours > 0 && (
                        <div className="text-xs font-medium">{day.hours.toFixed(1)}h</div>
                      )}
                      {day.isLeave && <div className="text-xs text-blue-600">Congé</div>}
                      {day.isHoliday && <div className="text-xs text-purple-600">Férié</div>}
                    </>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1">
            <span className={cn('w-2.5 h-2.5 rounded-full', color)} />
            <span className="capitalize">{
              status === 'full' ? 'Complet' :
              status === 'partial' ? 'Partiel' :
              status === 'missing' ? 'Manquant' :
              status === 'leave' ? 'Congé' :
              status === 'holiday' ? 'Férié' :
              'Weekend'
            }</span>
          </div>
        ))}
      </div>

      {/* Week summaries */}
      {timesheet && timesheet.weekSummaries.length > 0 && (
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3">Résumé par semaine</h3>
          <div className="space-y-2">
            {timesheet.weekSummaries.map((ws) => (
              <div key={ws.weekStart} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Semaine du {new Date(ws.weekStart).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
                <span className={cn(
                  'font-medium',
                  ws.total >= ws.expected && ws.expected > 0 ? 'text-green-600' : ws.total > 0 ? 'text-yellow-600' : 'text-red-600',
                )}>
                  {ws.total.toFixed(1)}h / {ws.expected.toFixed(1)}h
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
