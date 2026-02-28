'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
type CustomFieldType = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect';
type CustomFieldsData = Record<string, string | number | boolean | string[] | null>;

interface CustomFieldConfig {
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  options?: string[];
  showInList: boolean;
  order: number;
}

interface Props {
  config: CustomFieldConfig[];
  defaultValues?: CustomFieldsData;
  onSubmit: (data: CustomFieldsData) => void;
  isLoading?: boolean;
  readOnly?: boolean;
}

export function DynamicForm({ config, defaultValues, onSubmit, isLoading, readOnly }: Props) {
  const { register, handleSubmit, setValue, watch, reset } = useForm<Record<string, unknown>>({
    defaultValues: defaultValues ?? {},
  });

  useEffect(() => {
    if (defaultValues) reset(defaultValues);
  }, [defaultValues, reset]);

  const sortedFields = [...config].sort((a, b) => a.order - b.order);

  if (config.length === 0) {
    return (
      <div className="text-muted-foreground text-sm py-4">
        Aucun champ personnalisé configuré pour ce client.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
      {sortedFields.map((field) => {
        const fieldKey = field.key;
        const currentValue = watch(fieldKey);

        return (
          <div key={fieldKey} className="space-y-1.5">
            <Label htmlFor={fieldKey} className="flex items-center gap-1">
              {field.label}
              {field.required && <span className="text-destructive">*</span>}
            </Label>

            {field.type === 'text' && (
              <Input
                id={fieldKey}
                {...register(fieldKey)}
                readOnly={readOnly}
                className={readOnly ? 'bg-muted cursor-default' : ''}
              />
            )}

            {field.type === 'number' && (
              <Input
                id={fieldKey}
                type="number"
                step="any"
                {...register(fieldKey, { valueAsNumber: true })}
                readOnly={readOnly}
                className={readOnly ? 'bg-muted cursor-default' : ''}
              />
            )}

            {field.type === 'date' && (
              <Input
                id={fieldKey}
                type="date"
                {...register(fieldKey)}
                readOnly={readOnly}
                className={readOnly ? 'bg-muted cursor-default' : ''}
              />
            )}

            {field.type === 'boolean' && (
              <div className="flex items-center gap-2 h-9">
                <Switch
                  id={fieldKey}
                  checked={!!currentValue}
                  onCheckedChange={(checked: boolean | 'indeterminate') => setValue(fieldKey, !!checked)}
                  disabled={readOnly}
                />
                <Label htmlFor={fieldKey} className="text-sm font-normal">
                  {currentValue ? 'Oui' : 'Non'}
                </Label>
              </div>
            )}

            {field.type === 'select' && (
              <Select
                value={String(currentValue ?? '')}
                onValueChange={(v) => setValue(fieldKey, v)}
                disabled={readOnly}
              >
                <SelectTrigger id={fieldKey}>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {field.type === 'multiselect' && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1 min-h-9 p-2 border rounded-md bg-background">
                  {((currentValue as string[]) ?? []).map((val) => (
                    <Badge key={val} variant="secondary" className="cursor-pointer" onClick={() => {
                      if (!readOnly) {
                        const current = (currentValue as string[]) ?? [];
                        setValue(fieldKey, current.filter((v) => v !== val));
                      }
                    }}>
                      {val} {!readOnly && '×'}
                    </Badge>
                  ))}
                  {((currentValue as string[]) ?? []).length === 0 && (
                    <span className="text-muted-foreground text-sm">Aucune sélection</span>
                  )}
                </div>
                {!readOnly && (
                  <div className="flex flex-wrap gap-2">
                    {field.options?.map((opt) => {
                      const selected = ((currentValue as string[]) ?? []).includes(opt);
                      return (
                        <div key={opt} className="flex items-center gap-1.5">
                          <Checkbox
                            id={`${fieldKey}-${opt}`}
                            checked={selected}
                            onCheckedChange={(checked: boolean | 'indeterminate') => {
                              const current = (currentValue as string[]) ?? [];
                              setValue(
                                fieldKey,
                                checked ? [...current, opt] : current.filter((v) => v !== opt),
                              );
                            }}
                          />
                          <Label htmlFor={`${fieldKey}-${opt}`} className="text-sm font-normal cursor-pointer">
                            {opt}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {!readOnly && (
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Enregistrer
        </Button>
      )}
    </form>
  );
}
