import { Header } from '@/components/layout/header';
import { QuotesView } from './quotes-view';

export const metadata = { title: 'Devis' };

export default function QuotesPage() {
  return (
    <>
      <Header title="Devis" />
      <div className="p-6 space-y-6">
        <QuotesView />
      </div>
    </>
  );
}
