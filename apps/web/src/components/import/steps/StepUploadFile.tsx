'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { ImportEntityType } from '@exeteam/shared';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { UploadCloud, File, AlertCircle } from 'lucide-react';
import { uploadImportFile } from '@/lib/api/import';
import type { ImportTemplateDto } from '@/lib/api/import';

interface Props {
  entityType: ImportEntityType;
  templates: ImportTemplateDto[];
  onUploaded: (fileUrl: string, fileName: string, headers: string[]) => void;
  onTemplateSelected: (template: ImportTemplateDto) => void;
  onNext: () => void;
  onBack: () => void;
  fileUrl: string | null;
  fileName: string | null;
}

export function StepUploadFile({
  entityType,
  templates,
  onUploaded,
  onTemplateSelected,
  onNext,
  onBack,
  fileUrl,
  fileName,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: globalThis.File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      setUploading(true);
      setError(null);
      try {
        const result = await uploadImportFile(file);
        onUploaded(result.fileUrl, result.fileName, result.headers);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
      } finally {
        setUploading(false);
      }
    },
    [onUploaded],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    disabled: uploading,
  });

  const relevantTemplates = templates.filter((t) => t.entityType === entityType);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Charger le fichier Excel</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Formats acceptés : .xlsx, .xls — Taille max : 10 MB
        </p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input {...getInputProps()} />
        <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        {isDragActive ? (
          <p className="text-primary font-medium">Déposez le fichier ici…</p>
        ) : (
          <>
            <p className="font-medium">Glissez-déposez votre fichier ici</p>
            <p className="text-sm text-muted-foreground mt-1">ou cliquez pour parcourir</p>
          </>
        )}
        {uploading && <p className="mt-3 text-sm text-muted-foreground">Chargement en cours…</p>}
      </div>

      {/* Uploaded file indicator */}
      {fileUrl && fileName && (
        <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-muted/30">
          <File className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium truncate">{fileName}</span>
          <span className="text-xs text-green-600 ml-auto">Chargé</span>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Template selector */}
      {relevantTemplates.length > 0 && (
        <div className="space-y-2">
          <Label>Utiliser un modèle de mappage sauvegardé</Label>
          <Select
            onValueChange={(id) => {
              const tpl = relevantTemplates.find((t) => t.id === id);
              if (tpl) onTemplateSelected(tpl);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choisir un modèle…" />
            </SelectTrigger>
            <SelectContent>
              {relevantTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Retour
        </Button>
        <Button onClick={onNext} disabled={!fileUrl}>
          Suivant
        </Button>
      </div>
    </div>
  );
}
