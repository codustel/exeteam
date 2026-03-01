'use client';

import { useQuery } from '@tanstack/react-query';
import { ImportJobStatus } from '@exeteam/shared';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2, Download } from 'lucide-react';
import { getImportJob } from '@/lib/api/import';

interface Props {
  jobId: string;
  onReset: () => void;
}

function statusBadgeVariant(status: ImportJobStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case ImportJobStatus.Done:
      return 'default';
    case ImportJobStatus.Failed:
      return 'destructive';
    case ImportJobStatus.Processing:
      return 'secondary';
    default:
      return 'outline';
  }
}

function downloadErrorCsv(errors: { row: number; field: string; message: string }[], fileName: string) {
  const lines = ['Ligne,Champ,Message', ...errors.map((e) => `${e.row},${e.field},"${e.message}"`)];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `erreurs-import-${fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function StepProgress({ jobId, onReset }: Props) {
  const { data: job } = useQuery({
    queryKey: ['importJob', jobId],
    queryFn: () => getImportJob(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === ImportJobStatus.Processing || status === ImportJobStatus.Pending
        ? 2000
        : false;
    },
  });

  if (!job) {
    return (
      <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Chargement…</span>
      </div>
    );
  }

  const progress =
    job.totalRows > 0 ? Math.round((job.processedRows / job.totalRows) * 100) : 0;
  const isDone = job.status === ImportJobStatus.Done;
  const isFailed = job.status === ImportJobStatus.Failed;
  const isProcessing =
    job.status === ImportJobStatus.Processing || job.status === ImportJobStatus.Pending;
  const errors = job.errors ?? [];
  const visibleErrors = errors.slice(0, 20);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Import en cours</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Suivez la progression de votre import.
        </p>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3">
        {isDone && <CheckCircle2 className="h-5 w-5 text-green-600" />}
        {isFailed && <XCircle className="h-5 w-5 text-destructive" />}
        {isProcessing && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        <Badge variant={statusBadgeVariant(job.status as ImportJobStatus)}>
          {job.status === 'pending' && 'En attente'}
          {job.status === 'processing' && 'En cours…'}
          {job.status === 'done' && 'Terminé'}
          {job.status === 'failed' && 'Échec'}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>{job.processedRows} / {job.totalRows} lignes traitées</span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="h-3" />
      </div>

      {/* Summary on completion */}
      {isDone && (
        <Alert className="border-green-500 bg-green-50 text-green-800">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            Import terminé : {job.processedRows - job.errorRows} réussis, {job.errorRows} erreur
            {job.errorRows !== 1 ? 's' : ''}
          </AlertDescription>
        </Alert>
      )}

      {isFailed && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            L&apos;import a échoué. Vérifiez les erreurs ci-dessous.
          </AlertDescription>
        </Alert>
      )}

      {/* Error log */}
      {visibleErrors.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-destructive">
              Erreurs ({errors.length})
              {errors.length > 20 && ' — affichage des 20 premières'}
            </p>
            {isDone && errors.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadErrorCsv(errors, job.fileName)}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Télécharger les erreurs (CSV)
              </Button>
            )}
          </div>
          <div className="rounded-md border overflow-hidden text-xs">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium w-16">Ligne</th>
                  <th className="px-3 py-2 text-left font-medium w-28">Champ</th>
                  <th className="px-3 py-2 text-left font-medium">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleErrors.map((e, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="px-3 py-1.5 text-muted-foreground">{e.row}</td>
                    <td className="px-3 py-1.5 font-mono">{e.field || '—'}</td>
                    <td className="px-3 py-1.5 text-destructive">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(isDone || isFailed) && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={onReset}>
            Nouvel import
          </Button>
        </div>
      )}
    </div>
  );
}
