'use client';

import { ImportEntityType, AVAILABLE_FIELDS } from '@exeteam/shared';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  entityType: ImportEntityType;
  fileName: string;
  mappings: Record<string, string>;
  onDuplicate: 'skip' | 'update';
  onDuplicateChange: (v: 'skip' | 'update') => void;
  previewRows: Record<string, unknown>[];
  onStart: () => void;
  onBack: () => void;
  isStarting: boolean;
}

export function StepConfirm({
  entityType,
  fileName,
  mappings,
  onDuplicate,
  onDuplicateChange,
  previewRows,
  onStart,
  onBack,
  isStarting,
}: Props) {
  const availableFields = AVAILABLE_FIELDS[entityType] ?? [];
  const mappingEntries = Object.entries(mappings);

  // Preview: apply mappings to first 5 rows
  const previewMapped = previewRows.slice(0, 5).map((row) => {
    const obj: Record<string, unknown> = {};
    for (const [excelCol, dbField] of mappingEntries) {
      obj[dbField] = row[excelCol] ?? '';
    }
    return obj;
  });

  const previewFields = mappingEntries.map(([, dbField]) => dbField);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Options & Confirmation</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Vérifiez le résumé avant de lancer l&apos;import.
        </p>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="pt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-32">Fichier</span>
            <span className="font-medium truncate">{fileName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-32">Type</span>
            <Badge variant="secondary">{entityType}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-32">Mappages</span>
            <span>{mappingEntries.length} colonnes configurées</span>
          </div>
        </CardContent>
      </Card>

      {/* Duplicate strategy */}
      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
        <div>
          <p className="font-medium text-sm">Mettre à jour les doublons</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {onDuplicate === 'update'
              ? 'Les enregistrements existants seront mis à jour'
              : 'Les doublons seront ignorés (comportement par défaut)'}
          </p>
        </div>
        <Switch
          checked={onDuplicate === 'update'}
          onCheckedChange={(v) => onDuplicateChange(v ? 'update' : 'skip')}
        />
      </div>

      {/* Preview table */}
      {previewMapped.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Aperçu des 5 premières lignes</p>
          <div className="overflow-x-auto rounded-md border">
            <table className="text-xs w-full">
              <thead className="bg-muted">
                <tr>
                  {previewFields.map((f) => (
                    <th key={f} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                      {availableFields.find((a) => a.value === f)?.label ?? f}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {previewMapped.map((row, i) => (
                  <tr key={i}>
                    {previewFields.map((f) => (
                      <td key={f} className="px-3 py-2 max-w-[200px] truncate">
                        {String(row[f] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Retour
        </Button>
        <Button onClick={onStart} disabled={isStarting}>
          {isStarting ? 'Démarrage…' : "Lancer l'import"}
        </Button>
      </div>
    </div>
  );
}
