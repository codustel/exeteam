import { Header } from '@/components/layout/header';
import { ClientsTable } from './clients-table';

export const metadata = { title: 'Clients' };

export default function ClientsPage() {
  return (
    <>
      <Header title="Clients" />
      <div className="p-6 space-y-6">
        <ClientsTable />
      </div>
    </>
  );
}
