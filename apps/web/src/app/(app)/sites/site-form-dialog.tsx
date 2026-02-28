'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sitesApi } from '@/lib/api/sites';
import { apiRequest } from '@/lib/api/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const schema = z.object({
  reference: z.string().min(1, 'Requis'),
  name: z.string().min(1, 'Requis'),
  clientId: z.string().uuid('Client requis'),
  operatorId: z.string().uuid().optional(),
  typologieId: z.string().uuid().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  commune: z.string().optional(),
  departement: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<FormValues>;
  siteId?: string;
  defaultClientId?: string;
}

export function SiteFormDialog({ open, onOpenChange, defaultValues, siteId, defaultClientId }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!siteId;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { clientId: defaultClientId, ...defaultValues },
  });

  const { data: typologies = [] } = useQuery({
    queryKey: ['sites', 'typologies'],
    queryFn: () => sitesApi.getTypologies(),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', 'all'],
    queryFn: () => apiRequest<{ data: Array<{ id: string; name: string }> }>('/clients?limit=200').then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      isEdit ? sitesApi.update(siteId!, data) : sitesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      onOpenChange(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le site' : 'Nouveau site'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="reference" render={({ field }) => (
                <FormItem>
                  <FormLabel>Référence *</FormLabel>
                  <FormControl><Input placeholder="REF-001" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom *</FormLabel>
                  <FormControl><Input placeholder="Pylône Nord" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="clientId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Client *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="typologieId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Typologie</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {typologies.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Adresse</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="postalCode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Code postal</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="commune" render={({ field }) => (
                <FormItem>
                  <FormLabel>Commune</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="departement" render={({ field }) => (
                <FormItem>
                  <FormLabel>Département</FormLabel>
                  <FormControl><Input placeholder="75" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Coordonnées GPS (optionnel)</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="latitude" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl><Input type="number" step="any" placeholder="48.8566" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="longitude" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl><Input type="number" step="any" placeholder="2.3522" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
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
