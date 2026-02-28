import { Header } from '@/components/layout/header';
import { LeavesList } from './leaves-list';

export const metadata = { title: 'Congés' };

export default function LeavesPage() {
  return (
    <>
      <Header title="Congés" />
      <div className="p-6 space-y-6">
        <LeavesList />
      </div>
    </>
  );
}
