'use client';

import { type ProjectDetail } from '@/lib/api/projects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  project: ProjectDetail;
}

export function ProjectCustomFieldsTab({ project }: Props) {
  if (!project.customFieldsConfig) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg">
        Aucun champ personnalisé configuré pour ce projet.
        Configurez-les depuis la section Champs Personnalisés (Sprint 2C).
      </div>
    );
  }

  const config = project.customFieldsConfig as Record<string, unknown>;
  const fields = Array.isArray(config['fields'])
    ? (config['fields'] as Array<{ key: string; label: string; type: string }>)
    : [];

  if (fields.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg">
        La configuration ne contient pas de champs définis.
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Champs personnalisés du projet</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Les champs personnalisés sont gérés via le composant DynamicForm (Sprint 2C).
          Intégrez le composant <code className="bg-muted px-1 rounded">DynamicForm</code> ici
          avec <code className="bg-muted px-1 rounded">config={JSON.stringify(config)}</code>.
        </p>
        <div className="mt-4 space-y-2">
          {fields.map((f) => (
            <div key={f.key} className="flex items-center justify-between py-2 border-b last:border-0">
              <span className="text-sm font-medium">{f.label}</span>
              <span className="text-xs text-muted-foreground">{f.type}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
