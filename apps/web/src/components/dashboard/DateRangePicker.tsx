'use client';

import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';

interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
}

export function DateRangePicker({ value, onChange, placeholder = 'Sélectionner une période' }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const label =
    value?.from && value?.to
      ? `${format(value.from, 'd MMM yyyy', { locale: fr })} – ${format(value.to, 'd MMM yyyy', { locale: fr })}`
      : value?.from
      ? format(value.from, 'd MMM yyyy', { locale: fr })
      : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 min-w-[220px] justify-start font-normal">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span>{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={(range) => {
            onChange(range);
            if (range?.from && range?.to) setOpen(false);
          }}
          numberOfMonths={2}
          locale={fr}
        />
        <div className="flex justify-end gap-2 p-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { onChange(undefined); setOpen(false); }}
          >
            Réinitialiser
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
