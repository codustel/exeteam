'use client';

import { ImportEntityType } from '@exeteam/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { downloadImportTemplate } from '@/lib/import-templates';

const ENTITY_OPTIONS: { value: ImportEntityType; label: string; description: string }[] = [
  { value: ImportEntityType.Clients, label: 'Clients', description: 'Importer des fiches client' },
  { value: ImportEntityType.Employees, label: 'Employés', description: 'Importer des fiches employé' },
  { value: ImportEntityType.Sites, label: 'Sites', description: 'Importer des sites client' },
  { value: ImportEntityType.Tasks, label: 'Tâches', description: 'Importer des tâches de projet' },
  {
    value: ImportEntityType.PurchaseInvoices,
    label: "Factures d'achat",
    description: "Importer des factures fournisseurs",
  },
];

interface Props {
  value: ImportEntityType | null;
  onChange: (v: ImportEntityType) => void;
  onNext: () => void;
}

export function StepChooseEntity({ value, onChange, onNext }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Choisir le type d&apos;entité à importer</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Sélectionnez le type de données que vous souhaitez importer.
        </p>
      </div>

      <RadioGroup
        value={value ?? ''}
        onValueChange={(v: string) => onChange(v as ImportEntityType)}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {ENTITY_OPTIONS.map((opt) => (
          <Label key={opt.value} htmlFor={opt.value} className="cursor-pointer">
            <Card
              className={`transition-colors ${
                value === opt.value ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
              }`}
            >
              <CardContent className="flex items-start gap-3 pt-4">
                <RadioGroupItem value={opt.value} id={opt.value} className="mt-0.5" />
                <div>
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </div>
              </CardContent>
            </Card>
          </Label>
        ))}
      </RadioGroup>

      {value && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadImportTemplate(value)}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Télécharger le modèle Excel pour « {ENTITY_OPTIONS.find((o) => o.value === value)?.label} »
        </Button>
      )}

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!value}>
          Suivant
        </Button>
      </div>
    </div>
  );
}
