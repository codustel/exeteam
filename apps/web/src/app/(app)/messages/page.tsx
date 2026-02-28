import { Header } from '@/components/layout/header';
import { MessagesLayout } from './messages-layout';

export const metadata = { title: 'Messages' };

export default function MessagesPage() {
  return (
    <>
      <Header title="Messagerie" />
      <MessagesLayout />
    </>
  );
}
