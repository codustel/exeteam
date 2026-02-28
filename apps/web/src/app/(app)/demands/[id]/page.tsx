import { Header } from '@/components/layout/header';
import { DemandDetailClient } from './demand-detail-client';

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata = { title: 'Demande client' };

export default async function DemandDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <>
      <Header title="Demande client" />
      <DemandDetailClient id={id} />
    </>
  );
}
