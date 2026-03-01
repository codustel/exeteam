'use client';

import { useState, useEffect } from 'react';
import { Settings2, GripVertical, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  locked?: boolean; // If true, can't be hidden (e.g., name column)
}

interface ColumnSelectorProps {
  tableKey: string; // Unique key for localStorage persistence
  columns: ColumnConfig[];
  onChange: (columns: ColumnConfig[]) => void;
  defaultColumns?: ColumnConfig[];
}

function SortableColumnItem({
  column,
  onToggle
}: {
  column: ColumnConfig;
  onToggle: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent"
    >
      <button {...attributes} {...listeners} className="cursor-grab">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <Checkbox
        checked={column.visible}
        onCheckedChange={() => onToggle(column.id)}
        disabled={column.locked}
        id={`col-${column.id}`}
      />
      <label htmlFor={`col-${column.id}`} className="text-sm flex-1 cursor-pointer">
        {column.label}
      </label>
    </div>
  );
}

export function ColumnSelector({ tableKey, columns, onChange, defaultColumns }: ColumnSelectorProps) {
  const [open, setOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`columns_${tableKey}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ColumnConfig[];
        // Merge saved with current columns (in case new columns were added)
        const merged = columns.map(col => {
          const savedCol = parsed.find(s => s.id === col.id);
          return savedCol ? { ...col, visible: savedCol.visible } : col;
        });
        // Reorder based on saved order
        const ordered = parsed
          .map(s => merged.find(m => m.id === s.id))
          .filter(Boolean) as ColumnConfig[];
        // Add any new columns not in saved
        const newCols = merged.filter(m => !parsed.find(s => s.id === m.id));
        onChange([...ordered, ...newCols]);
      } catch {
        // ignore parse errors
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey]);

  // Save to localStorage whenever columns change
  useEffect(() => {
    localStorage.setItem(`columns_${tableKey}`, JSON.stringify(columns));
  }, [columns, tableKey]);

  const handleToggle = (id: string) => {
    onChange(columns.map(col =>
      col.id === id && !col.locked ? { ...col, visible: !col.visible } : col
    ));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = columns.findIndex(c => c.id === active.id);
      const newIndex = columns.findIndex(c => c.id === over.id);
      onChange(arrayMove(columns, oldIndex, newIndex));
    }
  };

  const handleReset = () => {
    if (defaultColumns) {
      onChange(defaultColumns);
      localStorage.removeItem(`columns_${tableKey}`);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1">
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Colonnes</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <div className="flex items-center justify-between mb-2 px-2">
          <span className="text-sm font-medium">Colonnes visibles</span>
          {defaultColumns && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 px-2 text-xs">
              <RotateCcw className="h-3 w-3 mr-1" />
              Réinitialiser
            </Button>
          )}
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={columns.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="max-h-[300px] overflow-y-auto">
              {columns.map((column) => (
                <SortableColumnItem
                  key={column.id}
                  column={column}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </PopoverContent>
    </Popover>
  );
}
