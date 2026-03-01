'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ImportEntityType } from '@exeteam/shared';
import { Card, CardContent } from '@/components/ui/card';
import { StepChooseEntity } from './steps/StepChooseEntity';
import { StepUploadFile } from './steps/StepUploadFile';
import { StepMapColumns } from './steps/StepMapColumns';
import { StepConfirm } from './steps/StepConfirm';
import { StepProgress } from './steps/StepProgress';
import { listImportTemplates, startImport } from '@/lib/api/import';
import type { ImportTemplateDto } from '@/lib/api/import';

const STEPS = [
  "Choisir l'entité",
  'Charger le fichier',
  'Mapper les colonnes',
  'Confirmation',
  'Progression',
];

function StepIndicator({ current }: { current: number }) {
  return (
    <nav aria-label="Étapes" className="mb-8">
      <ol className="flex items-center gap-0">
        {STEPS.map((label, index) => {
          const isCompleted = index < current;
          const isCurrent = index === current;
          return (
            <li key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                    isCompleted
                      ? 'bg-primary border-primary text-primary-foreground'
                      : isCurrent
                      ? 'border-primary text-primary'
                      : 'border-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                <span
                  className={`text-xs hidden sm:block ${
                    isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 transition-colors ${
                    isCompleted ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function ImportWizard() {
  const [step, setStep] = useState(0);
  const [entityType, setEntityType] = useState<ImportEntityType | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [onDuplicate, setOnDuplicate] = useState<'skip' | 'update'>('skip');
  const [jobId, setJobId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const { data: templates = [] } = useQuery<ImportTemplateDto[]>({
    queryKey: ['importTemplates', entityType],
    queryFn: () => listImportTemplates(entityType ?? undefined),
    enabled: !!entityType,
  });

  function handleUploaded(url: string, name: string, headers: string[]) {
    setFileUrl(url);
    setFileName(name);
    setExcelHeaders(headers);
    setMappings({});
  }

  function handleTemplateSelected(tpl: ImportTemplateDto) {
    setMappings(tpl.mappings as Record<string, string>);
  }

  async function handleStart() {
    if (!entityType || !fileUrl || !fileName) return;
    setIsStarting(true);
    try {
      const { jobId: id } = await startImport({
        entityType,
        fileUrl,
        fileName,
        mappings,
        onDuplicate,
      });
      setJobId(id);
      setStep(4);
    } catch (err) {
      console.error(err);
    } finally {
      setIsStarting(false);
    }
  }

  function handleReset() {
    setStep(0);
    setEntityType(null);
    setFileUrl(null);
    setFileName(null);
    setExcelHeaders([]);
    setMappings({});
    setOnDuplicate('skip');
    setJobId(null);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <StepIndicator current={step} />

        {step === 0 && (
          <StepChooseEntity
            value={entityType}
            onChange={setEntityType}
            onNext={() => setStep(1)}
          />
        )}

        {step === 1 && entityType && (
          <StepUploadFile
            entityType={entityType}
            templates={templates}
            onUploaded={handleUploaded}
            onTemplateSelected={handleTemplateSelected}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
            fileUrl={fileUrl}
            fileName={fileName}
          />
        )}

        {step === 2 && entityType && (
          <StepMapColumns
            entityType={entityType}
            excelHeaders={excelHeaders}
            mappings={mappings}
            onChange={setMappings}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && entityType && (
          <StepConfirm
            entityType={entityType}
            fileName={fileName ?? ''}
            mappings={mappings}
            onDuplicate={onDuplicate}
            onDuplicateChange={setOnDuplicate}
            previewRows={[]}
            onStart={handleStart}
            onBack={() => setStep(2)}
            isStarting={isStarting}
          />
        )}

        {step === 4 && jobId && <StepProgress jobId={jobId} onReset={handleReset} />}
      </CardContent>
    </Card>
  );
}
