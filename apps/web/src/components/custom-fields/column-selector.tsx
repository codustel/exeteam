'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Settings2 } from 'lucide-react';

export interface ColumnDef {
  key: string;
  label: string;
  required?: boolean; // cannot be hidden
}

interface Props {
  columns: ColumnDef[];
  visibleColumns: string[];
  onChange: (visible: string[]) => void;
}

export function ColumnSelector({ columns, visibleColumns, onChange }: Props) {
  const toggle = (key: string, checked: boolean) => {
    if (checked) {
      onChange([...visibleColumns, key]);
    } else {
      onChange(visibleColumns.filter((k) => k !== key));
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-2" />
          Colonnes
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="space-y-2">
          <p className="text-sm font-medium">Colonnes visibles</p>
          {columns.map((col) => (
            <div key={col.key} className="flex items-center gap-2">
              <Checkbox
                id={`col-${col.key}`}
                checked={visibleColumns.includes(col.key)}
                onCheckedChange={(checked: boolean | "indeterminate") => {
                  if (!col.required) toggle(col.key, !!checked);
                }}
                disabled={col.required}
              />
              <Label htmlFor={`col-${col.key}`} className="text-sm font-normal cursor-pointer">
                {col.label}
                {col.required && <span className="text-xs text-muted-foreground ml-1">(requis)</span>}
              </Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
