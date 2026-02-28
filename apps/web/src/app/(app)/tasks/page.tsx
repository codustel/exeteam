import { Header } from '@/components/layout/header';
import { TasksClient } from './tasks-client';

export const metadata = { title: 'Tâches' };

export default function TasksPage() {
  return (
    <>
      <Header title="Tâches" />
      <div className="p-6 space-y-6">
        <TasksClient />
      </div>
    </>
  );
}
