'use client';

import dynamic from 'next/dynamic';
import { type ProjectDetail } from '@/lib/api/projects';

// Frappe Gantt must be rendered client-side only (no SSR)
const FrappeGanttWrapper = dynamic(() => import('./gantt-wrapper'), { ssr: false });

interface Props {
  project: ProjectDetail;
}

export function ProjectGanttTab({ project }: Props) {
  const tasks = project.tasks
    .filter((t) => t.plannedStartDate && t.plannedEndDate)
    .map((t) => ({
      id: t.id,
      name: `${t.reference} — ${t.title}`,
      start: t.plannedStartDate!.split('T')[0],
      end: t.plannedEndDate!.split('T')[0],
      progress: ['terminee', 'livree'].includes(t.status) ? 100 : t.status === 'en_cours' ? 50 : 0,
      dependencies: '',
    }));

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg">
        Aucune tâche avec des dates prévues à afficher dans le Gantt
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Affichage des {tasks.length} tâches avec des dates planifiées.
      </p>
      <div className="border rounded-lg overflow-hidden bg-card">
        <FrappeGanttWrapper tasks={tasks} />
      </div>
    </div>
  );
}
