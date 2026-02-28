import { Header } from '@/components/layout/header';
import { DemandsTable } from './demands-table';

export const metadata = { title: 'Demandes client' };

export default function DemandsPage() {
  return (
    <>
      <Header title="Demandes client" />
      <div className="p-6 space-y-6">
        <DemandsTable />
      </div>
    </>
  );
}
