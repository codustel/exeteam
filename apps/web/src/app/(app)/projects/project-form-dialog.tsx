'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api/projects';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

const schema = z.object({
  title: z.string().min(1, 'Requis'),
  clientId: z.string().min(1, 'Requis'),
  description: z.string().optional(),
  status: z.string().min(1),
  priority: z.enum(['basse', 'normale', 'haute', 'urgente']),
  plannedStartDate: z.string().optional(),
  plannedEndDate: z.string().optional(),
  budgetHours: z.coerce.number().nonnegative().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<FormValues>;
  projectId?: string;
}

export function ProjectFormDialog({ open, onOpenChange, defaultValues, projectId }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!projectId;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'brouillon', priority: 'normale', ...defaultValues },
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      isEdit ? projectsApi.update(projectId!, data) : projectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onOpenChange(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le projet' : 'Nouveau projet'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Titre *</FormLabel>
                <FormControl><Input placeholder="Titre du projet" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="clientId" render={({ field }) => (
              <FormItem>
                <FormLabel>Client ID *</FormLabel>
                <FormControl><Input placeholder="UUID du client" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="Description du projet..." rows={3} {...field} />
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
            </div>

            <FormField control={form.control} name="budgetHours" render={({ field }) => (
              <FormItem>
                <FormLabel>Budget heures</FormLabel>
                <FormControl>
                  <Input type="number" min={0} step={0.5} placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {mutation.error && (
              <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEdit ? 'Enregistrer' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
