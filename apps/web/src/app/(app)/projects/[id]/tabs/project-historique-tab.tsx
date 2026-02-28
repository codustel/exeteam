'use client';

import { type ProjectDetail } from '@/lib/api/projects';
import { Clock } from 'lucide-react';

interface Props {
  project: ProjectDetail;
}

export function ProjectHistoriqueTab({ project }: Props) {
  // Future: fetch audit log entries for this project
  const events = [
    {
      id: '1',
      label: 'Projet créé',
      date: project.createdAt,
      description: `Référence ${project.reference} générée`,
    },
  ];

  return (
    <div className="space-y-3">
      {events.map((event, i) => (
        <div key={event.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF6600]/10 text-[#FF6600]">
              <Clock className="h-4 w-4" />
            </div>
            {i < events.length - 1 && (
              <div className="flex-1 w-px bg-border mt-2" />
            )}
          </div>
          <div className="pb-6">
            <p className="text-sm font-medium">{event.label}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(event.date).toLocaleString('fr-FR')}
            </p>
            {event.description && (
              <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
