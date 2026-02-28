import { Header } from '@/components/layout/header';
import { ProjectsClient } from './projects-client';

export const metadata = { title: 'Projets' };

export default function ProjectsPage() {
  return (
    <>
      <Header title="Projets" />
      <div className="p-6 space-y-6">
        <ProjectsClient />
      </div>
    </>
  );
}
