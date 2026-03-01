import { Metadata } from 'next';
import { ImportWizard } from '@/components/import/ImportWizard';
import { RecentImports } from '@/components/import/RecentImports';
import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = {
  title: 'Import Excel | ExeTeam',
  description: 'Importez vos données depuis des fichiers Excel',
};

export default function ImportPage() {
  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import Excel</h1>
        <p className="text-muted-foreground mt-1">
          Importez en masse vos clients, employés, sites, tâches ou factures depuis un fichier Excel.
        </p>
      </div>

      <ImportWizard />

      <Separator />

      <RecentImports />
    </div>
  );
}
