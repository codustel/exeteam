import { Metadata } from 'next';
import { Header } from '@/components/layout/header';
import { ClientsTable } from './clients-table';

export const metadata: Metadata = { title: 'Clients — ExeTeam' };

export default function ClientsPage() {
  return (
    <>
      <Header title="Clients" />
      <div className="p-6">
        <ClientsTable />
      </div>
    </>
  );
}
