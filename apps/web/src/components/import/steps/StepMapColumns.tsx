'use client';

import { useState } from 'react';
import { ImportEntityType, AVAILABLE_FIELDS, REQUIRED_FIELDS } from '@exeteam/shared';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Save, AlertCircle } from 'lucide-react';
import { saveImportTemplate } from '@/lib/api/import';

interface Props {
  entityType: ImportEntityType;
  excelHeaders: string[];
  mappings: Record<string, string>;
  onChange: (mappings: Record<string, string>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepMapColumns({ entityType, excelHeaders, mappings, onChange, onNext, onBack }: Props) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const availableFields = AVAILABLE_FIELDS[entityType] ?? [];
  const requiredFields = REQUIRED_FIELDS[entityType] ?? [];

  const missingRequired = requiredFields.filter((f) => !Object.values(mappings).includes(f));
  const canProceed = missingRequired.length === 0;

  function setMapping(excelCol: string, dbField: string) {
    const next = { ...mappings };
    if (!dbField || dbField === '__ignore__') {
      delete next[excelCol];
    } else {
      // Remove previous mapping of this db field to avoid duplicates
      for (const [col, field] of Object.entries(next)) {
        if (field === dbField && col !== excelCol) delete next[col];
      }
      next[excelCol] = dbField;
    }
    onChange(next);
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveImportTemplate({ name: templateName, entityType, mappings });
      setSaveOpen(false);
      setTemplateName('');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">Mapper les colonnes</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Associez chaque colonne Excel à un champ de la base de données.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSaveOpen(true)}
          disabled={Object.keys(mappings).length === 0}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          Sauvegarder comme modèle
        </Button>
      </div>

      {missingRequired.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Champs obligatoires non mappés :{' '}
            {missingRequired
              .map((f) => availableFields.find((a) => a.value === f)?.label ?? f)
              .join(', ')}
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-4 py-2 font-medium w-1/2">Colonne Excel</th>
              <th className="text-left px-4 py-2 font-medium w-1/2">Champ cible</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {excelHeaders.map((col) => {
              const mapped = mappings[col];
              const isRequired = mapped ? requiredFields.includes(mapped) : false;
              return (
                <tr key={col} className="hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs">{col}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Select
                        value={mapped ?? '__ignore__'}
                        onValueChange={(v) => setMapping(col, v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Ignorer cette colonne" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__ignore__">— Ignorer —</SelectItem>
                          {availableFields.map((f) => (
                            <SelectItem key={f.value} value={f.value}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isRequired && (
                        <Badge variant="destructive" className="text-xs shrink-0">
                          Requis
                        </Badge>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Retour
        </Button>
        <Button onClick={onNext} disabled={!canProceed}>
          Suivant
        </Button>
      </div>

      {/* Save template dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sauvegarder le modèle de mappage</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="template-name">Nom du modèle</Label>
            <Input
              id="template-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Ex: Import clients standard"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplate()}
            />
            {saveError && (
              <Alert variant="destructive">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveTemplate} disabled={!templateName.trim() || saving}>
              {saving ? 'Sauvegarde…' : 'Sauvegarder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
