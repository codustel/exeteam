import { Header } from '@/components/layout/header';
import { SitesTable } from './sites-table';

export const metadata = { title: 'Sites' };

export default function SitesPage() {
  return (
    <>
      <Header title="Sites" />
      <div className="p-6 space-y-6">
        <SitesTable />
      </div>
    </>
  );
}
