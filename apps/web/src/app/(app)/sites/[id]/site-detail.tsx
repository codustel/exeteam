'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sitesApi } from '@/lib/api/sites';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { MapPin, Edit, CheckSquare, Clock, Sliders, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { SiteFormDialog } from '../site-form-dialog';

interface Props { siteId: string }

const TASK_STATUS_LABELS: Record<string, string> = {
  a_traiter: 'À traiter',
  en_cours: 'En cours',
  en_attente: 'En attente',
  terminee: 'Terminée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

const TASK_STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  a_traiter: 'outline',
  en_cours: 'default',
  en_attente: 'secondary',
  terminee: 'default',
  livree: 'default',
  annulee: 'destructive',
};

export function SiteDetail({ siteId }: Props) {
  const [editOpen, setEditOpen] = useState(false);

  const { data: site, isLoading } = useQuery({
    queryKey: ['sites', siteId],
    queryFn: () => sitesApi.getOne(siteId),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-48 text-muted-foreground">Chargement...</div>;
  }
  if (!site) {
    return <div className="text-muted-foreground">Site introuvable</div>;
  }

  const hasGps = !!(site.latitude && site.longitude);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{site.name}</h2>
              <p className="text-muted-foreground font-mono text-sm">{site.reference}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={site.isActive ? 'default' : 'secondary'}>
              {site.isActive ? 'Actif' : 'Inactif'}
            </Badge>
            {(site as any).typologie && (
              <Badge variant="outline">{(site as any).typologie.name}</Badge>
            )}
            {hasGps && (
              <Badge variant="outline" className="text-green-600 border-green-200">
                <MapPin className="h-3 w-3 mr-1" />GPS disponible
              </Badge>
            )}
          </div>
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Edit className="h-4 w-4 mr-2" />
          Modifier
        </Button>
      </div>

      <Tabs defaultValue="infos">
        <TabsList>
          <TabsTrigger value="infos">Infos</TabsTrigger>
          <TabsTrigger value="taches">
            <CheckSquare className="h-4 w-4 mr-1" />
            Tâches ({(site as any)._count?.tasks ?? 0})
          </TabsTrigger>
          <TabsTrigger value="champs">
            <Sliders className="h-4 w-4 mr-1" />
            Champs perso
          </TabsTrigger>
          <TabsTrigger value="historique">
            <Clock className="h-4 w-4 mr-1" />
            Historique
          </TabsTrigger>
        </TabsList>

        <TabsContent value="infos" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Localisation */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Localisation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(site as any).address && <p>{(site as any).address}</p>}
                <p>
                  {(site as any).postalCode} {site.commune}
                  {(site as any).departement ? ` (${(site as any).departement})` : ''}
                </p>
                <p className="text-muted-foreground">{site.country}</p>
                {hasGps && (
                  <div className="pt-2 border-t">
                    <p className="font-medium mb-1">Coordonnées GPS</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {Number(site.latitude).toFixed(6)}, {Number(site.longitude).toFixed(6)}
                    </p>
                    <a
                      href={`https://www.google.com/maps?q=${site.latitude},${site.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary mt-1 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Voir sur Google Maps
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Affectations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Affectations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Client: </span>
                  <Link href={`/clients/${(site as any).client?.id}`} className="font-medium hover:text-primary">
                    {(site as any).client?.name}
                  </Link>
                </div>
                {(site as any).operator && (
                  <div>
                    <span className="text-muted-foreground">Opérateur: </span>
                    <span className="font-medium">{(site as any).operator.name}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* GPS Map placeholder */}
            {hasGps && (
              <Card className="col-span-full">
                <CardHeader>
                  <CardTitle className="text-base">Carte</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48 bg-muted rounded-lg flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <MapPin className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">
                        Lat: {Number(site.latitude).toFixed(6)} — Lng: {Number(site.longitude).toFixed(6)}
                      </p>
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${site.latitude}&mlon=${site.longitude}&zoom=15`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline mt-1 inline-block"
                      >
                        Ouvrir dans OpenStreetMap
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="taches" className="mt-4">
          {(site as any).tasks?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Aucune tâche sur ce site</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Titre</TableHead>
                  <TableHead>Code produit</TableHead>
                  <TableHead>Assigné à</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(site as any).tasks?.map((task: any) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <Link href={`/tasks/${task.id}`} className="font-mono text-sm hover:text-primary">
                        {task.reference}
                      </Link>
                    </TableCell>
                    <TableCell>{task.title}</TableCell>
                    <TableCell className="font-mono text-xs">{task.codeProduit?.code}</TableCell>
                    <TableCell>
                      {task.employee
                        ? `${task.employee.firstName} ${task.employee.lastName}`
                        : <span className="text-muted-foreground">Non assigné</span>
                      }
                    </TableCell>
                    <TableCell>
                      <Badge variant={TASK_STATUS_VARIANTS[task.status] ?? 'outline'}>
                        {TASK_STATUS_LABELS[task.status] ?? task.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="champs" className="mt-4">
          <div className="text-muted-foreground text-sm">
            Disponible après Sprint 2C (Custom Fields Engine)
          </div>
        </TabsContent>

        <TabsContent value="historique" className="mt-4">
          <div className="text-muted-foreground text-sm">
            Disponible après Sprint 3A
          </div>
        </TabsContent>
      </Tabs>

      <SiteFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        siteId={siteId}
        defaultValues={site as any}
      />
    </div>
  );
}
