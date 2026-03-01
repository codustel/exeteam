'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Loader2, ClipboardList } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { demandsApi, type DemandStatus } from '@/lib/api/demands';

const portalSchema = z.object({
  title: z.string().min(1, 'Requis'),
  description: z.string().optional(),
  desiredDelivery: z.string().optional(),
  codeProduitId: z.string().optional(),
  siteId: z.string().optional(),
});

type PortalFormValues = z.infer<typeof portalSchema>;

const statusConfig: Record<DemandStatus, { label: string; className: string }> = {
  nouvelle: { label: 'Nouvelle', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  en_cours: { label: 'En cours', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  terminee: { label: 'Terminée', className: 'bg-green-100 text-green-700 border-green-200' },
  annulee: { label: 'Annulée', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

interface Props {
  /**
   * The client ID inferred from the logged-in interlocuteur's session.
   * In a real implementation, resolve this server-side from the user's
   * interlocuteurId → clientId and pass it as a prop.
   */
  clientId: string;
  projectId: string;
}

export function PortalDemandsClient({ clientId, projectId }: Props) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'demands', clientId],
    queryFn: () => demandsApi.list({ clientId, limit: 50, page: 1 }),
  });

  const form = useForm<PortalFormValues>({
    resolver: zodResolver(portalSchema),
    defaultValues: {},
  });

  const createMutation = useMutation({
    mutationFn: (values: PortalFormValues) =>
      demandsApi.create({
        clientId,
        projectId,
        title: values.title,
        description: values.description,
        desiredDelivery: values.desiredDelivery,
        codeProduitId: values.codeProduitId || undefined,
        siteId: values.siteId || undefined,
        status: 'nouvelle',
        priority: 'normale',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'demands'] });
      setCreateOpen(false);
      form.reset();
    },
  });

  const demands = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mes demandes</h1>
          <p className="text-muted-foreground mt-1">
            Suivez l&apos;avancement de vos demandes et soumettez-en de nouvelles.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          style={{ backgroundColor: '#FF6600' }}
          className="text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle demande
        </Button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-4">
        {(['nouvelle', 'en_cours', 'terminee'] as DemandStatus[]).map((status) => {
          const sc = statusConfig[status];
          const count = demands.filter((d) => d.status === status).length;
          return (
            <div key={status} className="border rounded-lg p-4 bg-card">
              <div className="flex items-center gap-2 mb-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline" className={sc.className}>{sc.label}</Badge>
              </div>
              <p className="text-2xl font-bold">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Demands table */}
      <div className="border rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Titre</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Date demande</TableHead>
              <TableHead>Livraison souhaitée</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-muted animate-pulse rounded" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : demands.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  Vous n&apos;avez pas encore de demandes
                </TableCell>
              </TableRow>
            ) : (
              demands.map((demand) => {
                const sc = statusConfig[demand.status];
                return (
                  <TableRow key={demand.id}>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{demand.reference}</span>
                    </TableCell>
                    <TableCell className="font-medium">{demand.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={sc.className}>{sc.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(demand.requestedAt), 'dd/MM/yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {demand.desiredDelivery
                        ? format(new Date(demand.desiredDelivery), 'dd/MM/yyyy', { locale: fr })
                        : '—'}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Nouvelle demande</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titre *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Objet de la demande" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={4} placeholder="Décrivez votre demande..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="desiredDelivery"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Livraison souhaitée</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="codeProduitId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code produit (ID)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="UUID optionnel" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="siteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site (ID)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="UUID optionnel" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  style={{ backgroundColor: '#FF6600' }}
                  className="text-white hover:opacity-90"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Soumettre la demande
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
