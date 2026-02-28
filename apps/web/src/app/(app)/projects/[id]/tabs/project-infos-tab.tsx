'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, type ProjectDetail } from '@/lib/api/projects';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save } from 'lucide-react';

const schema = z.object({
  title: z.string().min(1, 'Requis'),
  description: z.string().optional(),
  status: z.string(),
  priority: z.enum(['basse', 'normale', 'haute', 'urgente']),
  plannedStartDate: z.string().optional(),
  plannedEndDate: z.string().optional(),
  actualStartDate: z.string().optional(),
  actualEndDate: z.string().optional(),
  budgetHours: z.coerce.number().nonnegative().optional(),
});

type FormValues = z.infer<typeof schema>;

function toDateInputValue(val: string | null | undefined): string {
  if (!val) return '';
  return val.split('T')[0];
}

interface Props {
  project: ProjectDetail;
}

export function ProjectInfosTab({ project }: Props) {
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: project.title,
      description: project.description ?? '',
      status: project.status,
      priority: project.priority as FormValues['priority'],
      plannedStartDate: toDateInputValue(project.plannedStartDate),
      plannedEndDate: toDateInputValue(project.plannedEndDate),
      actualStartDate: toDateInputValue(project.actualStartDate),
      actualEndDate: toDateInputValue(project.actualEndDate),
      budgetHours: project.budgetHours ? Number(project.budgetHours) : undefined,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) => projectsApi.update(project.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', project.id] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] });
    },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informations générales</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titre *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={4} placeholder="Description du projet..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Statut</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="brouillon">Brouillon</SelectItem>
                          <SelectItem value="a_traiter">À traiter</SelectItem>
                          <SelectItem value="en_cours">En cours</SelectItem>
                          <SelectItem value="en_revision">En révision</SelectItem>
                          <SelectItem value="terminee">Terminée</SelectItem>
                          <SelectItem value="livree">Livrée</SelectItem>
                          <SelectItem value="annulee">Annulée</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="priority" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priorité</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="basse">Basse</SelectItem>
                          <SelectItem value="normale">Normale</SelectItem>
                          <SelectItem value="haute">Haute</SelectItem>
                          <SelectItem value="urgente">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="plannedStartDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Début prévu</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="plannedEndDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fin prévue</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="actualStartDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Début réel</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="actualEndDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fin réelle</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="budgetHours" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget heures</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={0.5} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {mutation.error && (
                  <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>
                )}

                {mutation.isSuccess && (
                  <p className="text-sm text-green-600">Modifications enregistrées</p>
                )}

                <div className="flex justify-end">
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending
                      ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      : <Save className="h-4 w-4 mr-2" />}
                    Enregistrer
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Intervenants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Client</p>
              <p className="font-medium">{project.client.name}</p>
            </div>
            {project.operator && (
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Opérateur</p>
                <p className="font-medium">{project.operator.name}</p>
              </div>
            )}
            {project.responsible && (
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Responsable</p>
                <p className="font-medium">
                  {project.responsible.firstName} {project.responsible.lastName}
                </p>
              </div>
            )}
            {project.contact && (
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Contact client</p>
                <p className="font-medium">
                  {project.contact.firstName} {project.contact.lastName}
                </p>
                {project.contact.email && (
                  <p className="text-muted-foreground">{project.contact.email}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Statistiques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tâches totales</span>
              <span className="font-medium">{project._count.tasks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Demandes</span>
              <span className="font-medium">{project._count.demands}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pièces jointes</span>
              <span className="font-medium">{project._count.attachments}</span>
            </div>
            {project.budgetHours && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Budget heures</span>
                <span className="font-medium">{project.budgetHours}h</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
