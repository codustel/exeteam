'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Trash2, GripVertical, Loader2 } from 'lucide-react';
type CustomFieldType = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect';
type CustomFieldsData = Record<string, string | number | boolean | string[] | null>;

type CustomFieldConfig = {
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  options?: string[];
  showInList: boolean;
  order: number;
};

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Texte',
  number: 'Nombre',
  date: 'Date',
  boolean: 'Oui/Non',
  select: 'Liste déroulante',
  multiselect: 'Sélection multiple',
};

interface Props {
  clientId: string;
}

const EMPTY_FIELD: Omit<CustomFieldConfig, 'order'> = {
  key: '',
  label: '',
  type: 'text',
  required: false,
  options: [],
  showInList: false,
};

export function CustomFieldsBuilder({ clientId }: Props) {
  const queryClient = useQueryClient();
  const [newFieldOpen, setNewFieldOpen] = useState(false);
  const [formValues, setFormValues] = useState<Omit<CustomFieldConfig, 'order'>>(EMPTY_FIELD);
  const [optionInput, setOptionInput] = useState('');

  const { data: config = [], isLoading } = useQuery<CustomFieldConfig[]>({
    queryKey: ['custom-fields', 'config', clientId],
    queryFn: () => apiRequest<CustomFieldConfig[]>(`/custom-fields/config?clientId=${clientId}`),
  });

  const saveMutation = useMutation({
    mutationFn: (newConfig: CustomFieldConfig[]) =>
      apiRequest(`/custom-fields/clients/${clientId}/config`, {
        method: 'PUT',
        body: JSON.stringify(newConfig),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields', 'config', clientId] });
    },
  });

  const handleAddField = () => {
    if (!formValues.key || !formValues.label) return;
    const newField: CustomFieldConfig = {
      ...formValues,
      order: config.length,
    };
    saveMutation.mutate([...config, newField]);
    setNewFieldOpen(false);
    setFormValues(EMPTY_FIELD);
    setOptionInput('');
  };

  const handleRemoveField = (key: string) => {
    saveMutation.mutate(config.filter((f) => f.key !== key).map((f, i) => ({ ...f, order: i })));
  };

  const handleToggleShowInList = (key: string) => {
    saveMutation.mutate(
      config.map((f) => f.key === key ? { ...f, showInList: !f.showInList } : f),
    );
  };

  if (isLoading) {
    return <div className="text-muted-foreground text-sm">Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Champs personnalisables ({config.length})</h3>
        <Button size="sm" onClick={() => { setFormValues(EMPTY_FIELD); setNewFieldOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un champ
        </Button>
      </div>

      {config.length === 0 ? (
        <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
          Aucun champ configuré. Cliquez sur &quot;Ajouter un champ&quot; pour commencer.
        </div>
      ) : (
        <div className="space-y-2">
          {config.sort((a, b) => a.order - b.order).map((field) => (
            <div key={field.key} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{field.label}</span>
                  <Badge variant="outline" className="text-xs">{FIELD_TYPE_LABELS[field.type]}</Badge>
                  {field.required && <Badge variant="destructive" className="text-xs">Requis</Badge>}
                  {field.showInList && <Badge className="text-xs">Dans tableau</Badge>}
                </div>
                <span className="font-mono text-xs text-muted-foreground">{field.key}</span>
                {field.options && field.options.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {field.options.map((o) => (
                      <Badge key={o} variant="secondary" className="text-xs">{o}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Switch
                    id={`list-${field.key}`}
                    checked={field.showInList}
                    onCheckedChange={() => handleToggleShowInList(field.key)}
                    className="scale-75"
                  />
                  <Label htmlFor={`list-${field.key}`} className="text-xs">Liste</Label>
                </div>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleRemoveField(field.key)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add field dialog */}
      <Dialog open={newFieldOpen} onOpenChange={setNewFieldOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau champ personnalisé</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Clé technique (snake_case)</Label>
              <Input
                placeholder="hauteur_pylone"
                value={formValues.key}
                onChange={(e) => setFormValues((v) => ({
                  ...v,
                  key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                }))}
              />
              <p className="text-xs text-muted-foreground mt-1">Lettres minuscules, chiffres et underscores</p>
            </div>
            <div>
              <Label>Libellé</Label>
              <Input
                placeholder="Hauteur pylône"
                value={formValues.label}
                onChange={(e) => setFormValues((v) => ({ ...v, label: e.target.value }))}
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={formValues.type}
                onValueChange={(v) => setFormValues((v2) => ({ ...v2, type: v as CustomFieldType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {['select', 'multiselect'].includes(formValues.type) && (
              <div>
                <Label>Options</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="Ajouter une option..."
                    value={optionInput}
                    onChange={(e) => setOptionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && optionInput.trim()) {
                        e.preventDefault();
                        setFormValues((v) => ({
                          ...v,
                          options: [...(v.options ?? []), optionInput.trim()],
                        }));
                        setOptionInput('');
                      }
                    }}
                  />
                  <Button
                    type="button" size="sm" variant="outline"
                    onClick={() => {
                      if (optionInput.trim()) {
                        setFormValues((v) => ({
                          ...v,
                          options: [...(v.options ?? []), optionInput.trim()],
                        }));
                        setOptionInput('');
                      }
                    }}
                  >
                    Ajouter
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {formValues.options?.map((opt) => (
                    <Badge
                      key={opt} variant="secondary" className="cursor-pointer"
                      onClick={() => setFormValues((v) => ({
                        ...v,
                        options: v.options?.filter((o) => o !== opt),
                      }))}
                    >
                      {opt} ×
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="required"
                  checked={formValues.required}
                  onCheckedChange={(v: boolean | 'indeterminate') => setFormValues((f) => ({ ...f, required: !!v }))}
                />
                <Label htmlFor="required">Requis</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="showInList"
                  checked={formValues.showInList}
                  onCheckedChange={(v: boolean | 'indeterminate') => setFormValues((f) => ({ ...f, showInList: !!v }))}
                />
                <Label htmlFor="showInList">Afficher dans tableau</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFieldOpen(false)}>Annuler</Button>
            <Button
              onClick={handleAddField}
              disabled={!formValues.key || !formValues.label || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
