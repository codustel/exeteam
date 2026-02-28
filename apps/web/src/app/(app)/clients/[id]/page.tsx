import { Header } from '@/components/layout/header';
import { ClientDetail } from './client-detail';

interface Props { params: Promise<{ id: string }> }

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <>
      <Header title="Client" />
      <div className="p-6">
        <ClientDetail clientId={id} />
      </div>
    </>
  );
}
