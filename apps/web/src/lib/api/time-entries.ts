import { apiRequest } from './client';
import type { TimeEntryItem } from './tasks';

export interface TimeEntryListResponse {
  data: TimeEntryItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

type TimeEntryParams = {
  page?: number;
  limit?: number;
  taskId?: string;
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
  isValidated?: boolean;
};

// ── Timesheet types ────────────────────────────────────────────────

export interface TimesheetDayEntry {
  id: string;
  hours: number;
  comment?: string;
  isValidated: boolean;
  task?: { id: string; reference: string; title: string };
}

export interface TimesheetDay {
  date: string;
  dayOfWeek: number;
  entries: TimesheetDayEntry[];
  total: number;
  expected: number;
  isLeave: boolean;
  leaveType?: string;
  isHoliday: boolean;
  holidayName?: string;
  isWeekend: boolean;
  conflict: boolean;
}

export interface TimesheetTaskRow {
  taskId: string;
  taskReference: string;
  taskTitle: string;
  projectName: string;
  projectId: string;
  days: { hours: number; entries: TimesheetDayEntry[] }[];
  total: number;
}

export interface WeeklyTimesheetResponse {
  weekStart: string;
  weekEnd: string;
  days: TimesheetDay[];
  taskRows: TimesheetTaskRow[];
  weeklyTotal: number;
  weeklyExpected: number;
  leaveDays: number;
  occupationRate: number;
}

export interface MonthlyDay {
  date: string;
  dayOfMonth: number;
  dayOfWeek: number;
  hours: number;
  expected: number;
  status: 'full' | 'partial' | 'missing' | 'leave' | 'holiday' | 'weekend';
  isWeekend: boolean;
  isHoliday: boolean;
  isLeave: boolean;
}

export interface WeekSummary {
  weekStart: string;
  total: number;
  expected: number;
}

export interface MonthlyTimesheetResponse {
  month: string;
  days: MonthlyDay[];
  weekSummaries: WeekSummary[];
  monthlyTotal: number;
  monthlyExpected: number;
  occupationRate: number;
}

export interface TeamMemberSummary {
  employeeId: string;
  firstName: string;
  lastName: string;
  totalHours: number;
  expectedHours: number;
  occupationRate: number;
  validatedCount: number;
  pendingCount: number;
  pendingEntryIds: string[];
}

export interface TeamTimesheetResponse {
  weekStart: string;
  weekEnd: string;
  subordinates: TeamMemberSummary[];
  teamTotal: number;
  teamExpected: number;
}

// ── API methods ────────────────────────────────────────────────────

export const timeEntriesApi = {
  list: (params: TimeEntryParams = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiRequest<TimeEntryListResponse>(`/time-entries?${qs}`);
  },

  getOne: (id: string) => apiRequest<TimeEntryItem>(`/time-entries/${id}`),

  create: (data: { taskId: string; employeeId: string; date: string; hours: number; comment?: string }) =>
    apiRequest<TimeEntryItem>('/time-entries', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: { date?: string; hours?: number; comment?: string }) =>
    apiRequest<TimeEntryItem>(`/time-entries/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) => apiRequest(`/time-entries/${id}`, { method: 'DELETE' }),

  validate: (id: string) =>
    apiRequest<TimeEntryItem>(`/time-entries/${id}/validate`, { method: 'PATCH' }),

  // ── Timesheet endpoints ──────────────────────────────────────────

  getWeekly: (employeeId: string, weekStart: string) =>
    apiRequest<WeeklyTimesheetResponse>(
      `/time-entries/weekly?employeeId=${employeeId}&weekStart=${weekStart}`,
    ),

  getMonthly: (employeeId: string, month: string) =>
    apiRequest<MonthlyTimesheetResponse>(
      `/time-entries/monthly?employeeId=${employeeId}&month=${month}`,
    ),

  getTeam: (weekStart: string, managerId?: string) => {
    const qs = new URLSearchParams({ weekStart });
    if (managerId) qs.set('managerId', managerId);
    return apiRequest<TeamTimesheetResponse>(`/time-entries/team?${qs}`);
  },

  exportCsv: async (dateFrom: string, dateTo: string, employeeId?: string) => {
    const qs = new URLSearchParams({ dateFrom, dateTo, format: 'csv' });
    if (employeeId) qs.set('employeeId', employeeId);
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/time-entries/export?${qs}`,
      { headers: { Authorization: `Bearer ${session?.access_token}` } },
    );
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pointage_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  bulkValidate: (ids: string[]) =>
    apiRequest<{ validated: number }>('/time-entries/bulk-validate', {
      method: 'PATCH',
      body: JSON.stringify({ ids }),
    }),
};
