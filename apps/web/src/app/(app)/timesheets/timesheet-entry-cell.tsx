'use client';

import { useState, useRef, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  hours: number;
  isValidated: boolean;
  isLeave: boolean;
  isHoliday: boolean;
  isWeekend: boolean;
  conflict: boolean;
  onSave: (hours: number) => void;
}

export function TimesheetEntryCell({
  hours, isValidated, isLeave, isHoliday, isWeekend, conflict, onSave,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(hours || ''));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const disabled = isValidated || isWeekend;

  const handleBlur = () => {
    setEditing(false);
    const num = parseFloat(value);
    if (!isNaN(num) && num !== hours && num >= 0 && num <= 24) {
      onSave(num);
    } else {
      setValue(String(hours || ''));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleBlur();
    if (e.key === 'Escape') {
      setValue(String(hours || ''));
      setEditing(false);
    }
  };

  if (editing && !disabled) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={0}
        max={24}
        step={0.25}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-14 h-8 text-center text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => !disabled && setEditing(true)}
      disabled={disabled}
      className={cn(
        'w-14 h-8 text-center text-sm rounded transition-colors relative',
        disabled && 'cursor-not-allowed opacity-60',
        isWeekend && 'bg-gray-100',
        isLeave && !conflict && 'bg-blue-50 text-blue-700',
        isHoliday && 'bg-purple-50 text-purple-700',
        conflict && 'border-2 border-orange-400 bg-orange-50',
        !disabled && !isLeave && !isHoliday && !isWeekend && 'hover:bg-accent cursor-pointer',
        hours > 0 && !isLeave && !isHoliday && !isWeekend && 'font-medium',
      )}
    >
      {hours > 0 ? hours.toFixed(hours % 1 ? 2 : 0) : isLeave ? 'C' : isHoliday ? 'F' : '—'}
      {isValidated && (
        <Lock className="absolute top-0.5 right-0.5 h-2.5 w-2.5 text-green-600" />
      )}
    </button>
  );
}
