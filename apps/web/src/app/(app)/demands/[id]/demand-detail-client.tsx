'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft, Pencil, ExternalLink, Repeat2, CheckCircle2, XCircle,
  Clock, AlertTriangle, Loader2, Bell,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { demandsApi, type DemandStatus, type DemandPriority } from '@/lib/api/demands';
import { notificationsApi } from '@/lib/api/notifications';
import { DemandFormDialog } from '../demand-form-dialog';

const statusConfig: Record<DemandStatus, { label: string; className: string; icon: React.ElementType }> = {
  nouvelle: { label: 'Nouvelle', className: 'bg-blue-100 text-blue-700 border-blue-200', icon: AlertTriangle },
  en_cours: { label: 'En cours', className: 'bg-orange-100 text-orange-700 border-orange-200', icon: Clock },
  terminee: { label: 'Terminée', className: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  annulee: { label: 'Annulée', className: 'bg-gray-100 text-gray-600 border-gray-200', icon: XCircle },
};

const priorityConfig: Record<DemandPriority, { label: string; className: string }> = {
  basse: { label: 'Basse', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  normale: { label: 'Normale', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  haute: { label: 'Haute', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  urgente: { label: 'Urgente', className: 'bg-red-100 text-red-700 border-red-200' },
};

export function DemandDetailClient({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);

  const { data: demand, isLoading, error } = useQuery({
    queryKey: ['demands', 'detail', id],
    queryFn: () => demandsApi.getOne(id),
  });

  const { data: notificationsData } = useQuery({
    queryKey: ['notifications', 'list', 'demand', id],
    queryFn: () => notificationsApi.list({ limit: 20 }),
    enabled: !!demand,
    select: (data) => ({
      ...data,
      data: data.data.filter((n) => n.link?.includes(id)),
    }),
  });

  const convertMutation = useMutation({
    mutationFn: () => demandsApi.convertToTask(id),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ['demands'] });
      router.push(`/tasks/${task.id}`);
    },
    onError: (err: Error) => alert(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !demand) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Demande introuvable.</p>
        <Button variant="link" onClick={() => router.back()}>Retour</Button>
      </div>
    );
  }

  const sc = statusConfig[demand.status];
  const pc = priorityConfig[demand.priority];
  const StatusIcon = sc.icon;

  const notifications = notificationsData?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Back + Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2 mb-1">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {demand.reference}
            </span>
            <h1 className="text-2xl font-bold">{demand.title}</h1>
            <Badge variant="outline" className={`${sc.className} flex items-center gap-1`}>
              <StatusIcon className="h-3 w-3" />
              {sc.label}
            </Badge>
            <Badge variant="outline" className={pc.className}>{pc.label}</Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4 mr-2" />
          Modifier
        </Button>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left: 2/3 */}
        <div className="col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              {demand.description ? (
                <p className="text-sm text-foreground whitespace-pre-wrap">{demand.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Aucune description</p>
              )}
            </CardContent>
          </Card>

          {/* Data link */}
          {demand.dataLink && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Lien données</CardTitle>
              </CardHeader>
              <CardContent>
                <a
                  href={demand.dataLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  {demand.dataLink}
                </a>
              </CardContent>
            </Card>
          )}

          {/* Linked task */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tâche liée</CardTitle>
            </CardHeader>
            <CardContent>
              {demand.task ? (
                <Link href={`/tasks/${demand.task.id}`} className="block hover:bg-accent rounded-lg p-3 border transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">{demand.task.reference}</p>
                      <p className="font-medium mt-0.5">{demand.task.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {demand.task.plannedEndDate && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(demand.task.plannedEndDate), 'dd/MM/yyyy', { locale: fr })}
                        </span>
                      )}
                      <Badge variant="outline" className="text-xs">{demand.task.status}</Badge>
                    </div>
                  </div>
                  {demand.task.employee && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Assigné à {demand.task.employee.firstName} {demand.task.employee.lastName}
                    </p>
                  )}
                </Link>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">Aucune tâche liée</p>
                  {demand.status !== 'terminee' && demand.status !== 'annulee' && (
                    <Button
                      size="sm"
                      onClick={() => convertMutation.mutate()}
                      disabled={convertMutation.isPending}
                      style={{ backgroundColor: '#FF6600' }}
                      className="text-white hover:opacity-90"
                    >
                      {convertMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Repeat2 className="h-4 w-4 mr-2" />
                      )}
                      Convertir en tâche
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notifications history */}
          {notifications.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Historique notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {notifications.map((n) => (
                  <div key={n.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {format(new Date(n.createdAt), 'dd/MM HH:mm', { locale: fr })}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right sidebar: 1/3 */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Client</p>
                <p className="font-medium">{demand.client.name}</p>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Projet</p>
                <p className="font-medium">{demand.project.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{demand.project.reference}</p>
              </div>
              {demand.site && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Site</p>
                    <p className="font-medium">{demand.site.name}</p>
                    {demand.site.address && (
                      <p className="text-xs text-muted-foreground">{demand.site.address}</p>
                    )}
                  </div>
                </>
              )}
              {demand.codeProduit && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Code produit</p>
                    <p className="font-medium">{demand.codeProduit.code}</p>
                    <p className="text-xs text-muted-foreground">{demand.codeProduit.label}</p>
                  </div>
                </>
              )}
              {demand.demandeur && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Demandeur</p>
                    <p className="font-medium">{demand.demandeur.firstName} {demand.demandeur.lastName}</p>
                    <p className="text-xs text-muted-foreground">{demand.demandeur.email}</p>
                    {demand.demandeur.phone && (
                      <p className="text-xs text-muted-foreground">{demand.demandeur.phone}</p>
                    )}
                  </div>
                </>
              )}
              {demand.employee && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Assigné à</p>
                    <p className="font-medium">{demand.employee.firstName} {demand.employee.lastName}</p>
                  </div>
                </>
              )}
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Dates</p>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date demande</span>
                    <span>{format(new Date(demand.requestedAt), 'dd/MM/yyyy', { locale: fr })}</span>
                  </div>
                  {demand.desiredDelivery && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Livraison souhaitée</span>
                      <span>{format(new Date(demand.desiredDelivery), 'dd/MM/yyyy', { locale: fr })}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Créée le</span>
                    <span>{format(new Date(demand.createdAt), 'dd/MM/yyyy', { locale: fr })}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      {demand && (
        <DemandFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          demandId={demand.id}
          defaultValues={{
            clientId: demand.client.id,
            projectId: demand.project.id,
            title: demand.title,
            description: demand.description ?? '',
            dataLink: demand.dataLink ?? '',
            status: demand.status,
            priority: demand.priority,
            siteId: demand.site?.id ?? '',
            employeeId: demand.employee?.id ?? '',
            demandeurId: demand.demandeur?.id ?? '',
            codeProduitId: demand.codeProduit?.id ?? '',
            desiredDelivery: demand.desiredDelivery
              ? format(new Date(demand.desiredDelivery), 'yyyy-MM-dd')
              : '',
          }}
        />
      )}
    </div>
  );
}
