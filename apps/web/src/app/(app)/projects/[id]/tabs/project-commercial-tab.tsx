'use client';

import { type ProjectDetail } from '@/lib/api/projects';
import { TrendingUp } from 'lucide-react';

interface Props {
  project: ProjectDetail;
}

export function ProjectCommercialTab({ project }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
      <TrendingUp className="h-12 w-12 opacity-30" />
      <div className="text-center">
        <p className="font-medium">Onglet Commercial</p>
        <p className="text-sm mt-1">
          Cette section sera implémentée dans Sprint 3C (Commercial & Devis).
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Projet: {project.reference} — {project._count.demands} demande(s) liée(s)
        </p>
      </div>
    </div>
  );
}
