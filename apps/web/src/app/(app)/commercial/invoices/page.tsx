import { Header } from '@/components/layout/header';
import { InvoicesView } from './invoices-view';

export const metadata = { title: 'Factures' };

export default function InvoicesPage() {
  return (
    <>
      <Header title="Factures" />
      <div className="p-6 space-y-6">
        <InvoicesView />
      </div>
    </>
  );
}
