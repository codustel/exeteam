'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { timeEntriesApi } from '@/lib/api/time-entries';

interface Props {
  employeeId?: string;
  weekStart?: string;
  month?: string;
}

export function TimesheetExportButton({ employeeId, weekStart, month }: Props) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (range: 'week' | 'month') => {
    setExporting(true);
    try {
      let dateFrom: string;
      let dateTo: string;

      if (range === 'week' && weekStart) {
        dateFrom = weekStart;
        const end = new Date(weekStart);
        end.setDate(end.getDate() + 6);
        dateTo = end.toISOString().split('T')[0];
      } else if (range === 'month' && month) {
        const [y, m] = month.split('-').map(Number);
        dateFrom = `${y}-${String(m).padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        dateTo = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      } else {
        return;
      }

      await timeEntriesApi.exportCsv(dateFrom, dateTo, employeeId);
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={exporting}>
          <Download className="h-4 w-4 mr-2" />
          {exporting ? 'Export...' : 'Exporter'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {weekStart && (
          <DropdownMenuItem onClick={() => handleExport('week')}>
            Semaine en cours
          </DropdownMenuItem>
        )}
        {month && (
          <DropdownMenuItem onClick={() => handleExport('month')}>
            Mois en cours
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
