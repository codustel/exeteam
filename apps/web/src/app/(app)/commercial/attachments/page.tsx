import { Header } from '@/components/layout/header';
import { AttachmentsView } from './attachments-view';

export const metadata = { title: 'Bordereaux' };

export default function AttachmentsPage() {
  return (
    <>
      <Header title="Bordereaux d'attachement" />
      <div className="p-6 space-y-6">
        <AttachmentsView />
      </div>
    </>
  );
}
