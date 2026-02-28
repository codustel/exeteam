import { Header } from '@/components/layout/header';
import { ProjectDetailClient } from './project-detail-client';

interface Props {
  params: { id: string };
  searchParams: { tab?: string };
}

export const metadata = { title: 'Détail projet' };

export default function ProjectDetailPage({ params, searchParams }: Props) {
  return (
    <>
      <Header title="Détail projet" />
      <div className="p-6">
        <ProjectDetailClient id={params.id} defaultTab={searchParams.tab ?? 'infos'} />
      </div>
    </>
  );
}
