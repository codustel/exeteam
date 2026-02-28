import { Header } from '@/components/layout/header';
import { TaskDetailClient } from './task-detail-client';

interface Props {
  params: { id: string };
}

export const metadata = { title: 'Détail tâche' };

export default function TaskDetailPage({ params }: Props) {
  return (
    <>
      <Header title="Détail tâche" />
      <div className="p-6">
        <TaskDetailClient id={params.id} />
      </div>
    </>
  );
}
