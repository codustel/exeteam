'use client';

import { useQuery } from '@tanstack/react-query';
import { clientsApi } from '@/lib/api/clients';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Edit, MapPin, Users, FolderKanban, Package, FileText, Sliders, Clock } from 'lucide-react';
import { useState } from 'react';
import { ClientFormDialog } from '../client-form-dialog';
import { InterlocuteursTab } from './tabs/interlocuteurs-tab';
import { SitesTab } from './tabs/sites-tab';
import { CustomFieldsBuilder } from '@/components/custom-fields/custom-fields-builder';

interface Props { clientId: string }

export function ClientDetail({ clientId }: Props) {
  const [editOpen, setEditOpen] = useState(false);

  const { data: client, isLoading } = useQuery({
    queryKey: ['clients', clientId],
    queryFn: () => clientsApi.getOne(clientId),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-48 text-muted-foreground">Chargement...</div>;
  }

  if (!client) {
    return <div className="text-muted-foreground">Client introuvable</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {client.logoUrl ? (
            <img src={client.logoUrl} alt={client.name} className="w-16 h-16 rounded-lg object-contain border" />
          ) : (
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold">{client.name}</h2>
            {client.legalName && <p className="text-muted-foreground">{client.legalName}</p>}
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={client.isActive ? 'default' : 'secondary'}>
                {client.isActive ? 'Actif' : 'Inactif'}
              </Badge>
              {(client as any).tags?.map(({ tag }: any) => (
                <Badge
                  key={tag.id}
                  style={{ backgroundColor: tag.color + '20', color: tag.color }}
                  variant="outline"
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Edit className="h-4 w-4 mr-2" />
          Modifier
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="infos">
        <TabsList>
          <TabsTrigger value="infos">Infos</TabsTrigger>
          <TabsTrigger value="interlocuteurs">
            <Users className="h-4 w-4 mr-1" />
            Interlocuteurs
          </TabsTrigger>
          <TabsTrigger value="sites">
            <MapPin className="h-4 w-4 mr-1" />
            Sites
          </TabsTrigger>
          <TabsTrigger value="projets">
            <FolderKanban className="h-4 w-4 mr-1" />
            Projets
          </TabsTrigger>
          <TabsTrigger value="produits">
            <Package className="h-4 w-4 mr-1" />
            Codes produits
          </TabsTrigger>
          <TabsTrigger value="commercial">
            <FileText className="h-4 w-4 mr-1" />
            Commercial
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
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-semibold">Coordonnées</h3>
              <div className="space-y-1 text-sm">
                {(client as any).addressLine1 && <p>{(client as any).addressLine1}</p>}
                {(client as any).addressLine2 && <p>{(client as any).addressLine2}</p>}
                {(client.postalCode || client.city) && (
                  <p>{client.postalCode} {client.city}</p>
                )}
                {client.country && <p>{client.country}</p>}
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold">Identification</h3>
              <div className="space-y-1 text-sm">
                {(client as any).siret && <p>SIRET: {(client as any).siret}</p>}
                {(client as any).vatNumber && <p>TVA: {(client as any).vatNumber}</p>}
                {(client as any).email && <p>Email: {(client as any).email}</p>}
                {(client as any).phone && <p>Tél: {(client as any).phone}</p>}
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold">Opérateurs</h3>
              <div className="flex flex-wrap gap-2">
                {(client as any).operators?.map(({ operator }: any) => (
                  <Badge key={operator.id} variant="outline">{operator.name}</Badge>
                ))}
                {!(client as any).operators?.length && (
                  <span className="text-sm text-muted-foreground">Aucun opérateur</span>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="interlocuteurs" className="mt-4">
          <InterlocuteursTab clientId={clientId} />
        </TabsContent>

        <TabsContent value="sites" className="mt-4">
          <SitesTab clientId={clientId} />
        </TabsContent>

        <TabsContent value="projets" className="mt-4">
          <div className="text-muted-foreground text-sm">Disponible après Sprint 3A (Projets)</div>
        </TabsContent>

        <TabsContent value="produits" className="mt-4">
          <div className="text-muted-foreground text-sm">Disponible après Sprint 2C (Codes produits)</div>
        </TabsContent>

        <TabsContent value="commercial" className="mt-4">
          <div className="text-muted-foreground text-sm">Disponible après Sprint 3C (Commercial)</div>
        </TabsContent>

        <TabsContent value="champs" className="mt-4">
          <CustomFieldsBuilder clientId={clientId} />
        </TabsContent>

        <TabsContent value="historique" className="mt-4">
          <div className="text-muted-foreground text-sm">Disponible après Sprint 3A</div>
        </TabsContent>
      </Tabs>

      <ClientFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        clientId={clientId}
        defaultValues={client as any}
      />
    </div>
  );
}
