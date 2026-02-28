'use client';

import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api/projects';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FolderKanban } from 'lucide-react';
import Link from 'next/link';
import { ProjectInfosTab } from './tabs/project-infos-tab';
import { ProjectTasksTab } from './tabs/project-tasks-tab';
import { ProjectGanttTab } from './tabs/project-gantt-tab';
import { ProjectCustomFieldsTab } from './tabs/project-custom-fields-tab';
import { ProjectCommercialTab } from './tabs/project-commercial-tab';
import { ProjectHistoriqueTab } from './tabs/project-historique-tab';

const STATUS_COLORS: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-700',
  a_traiter: 'bg-yellow-100 text-yellow-800',
  en_cours: 'bg-blue-100 text-blue-800',
  en_revision: 'bg-purple-100 text-purple-800',
  terminee: 'bg-green-100 text-green-800',
  livree: 'bg-emerald-100 text-emerald-800',
  annulee: 'bg-red-100 text-red-700',
};

interface Props {
  id: string;
  defaultTab: string;
}

export function ProjectDetailClient({ id, defaultTab }: Props) {
  const { data: project, isLoading } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => projectsApi.getOne(id),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Chargement...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Projet introuvable
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb + header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Retour aux projets
          </Link>
          <div className="flex items-center gap-3">
            <FolderKanban className="h-5 w-5 text-[#FF6600]" />
            <h2 className="text-xl font-semibold">{project.title}</h2>
            <span className="font-mono text-sm text-muted-foreground">{project.reference}</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[project.status] ?? 'bg-gray-100 text-gray-700'}`}
            >
              {project.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{project.client.name}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab}>
        <TabsList className="border-b w-full justify-start rounded-none bg-transparent p-0 h-auto">
          {[
            { value: 'infos', label: 'Infos' },
            { value: 'taches', label: 'Tâches' },
            { value: 'gantt', label: 'Gantt' },
            { value: 'custom-fields', label: 'Champs personnalisés' },
            { value: 'commercial', label: 'Commercial' },
            { value: 'historique', label: 'Historique' },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#FF6600] data-[state=active]:text-[#FF6600] data-[state=active]:shadow-none pb-3 px-4"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="infos">
            <ProjectInfosTab project={project} />
          </TabsContent>
          <TabsContent value="taches">
            <ProjectTasksTab project={project} />
          </TabsContent>
          <TabsContent value="gantt">
            <ProjectGanttTab project={project} />
          </TabsContent>
          <TabsContent value="custom-fields">
            <ProjectCustomFieldsTab project={project} />
          </TabsContent>
          <TabsContent value="commercial">
            <ProjectCommercialTab project={project} />
          </TabsContent>
          <TabsContent value="historique">
            <ProjectHistoriqueTab project={project} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
