'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  code: z.string().min(1, 'Requis').max(50),
  designation: z.string().min(1, 'Requis'),
  clientId: z.string().uuid('Client requis'),
  productType: z.string().optional(),
  unitType: z.string().optional(),
  unitPrice: z.coerce.number().min(0),
  timeGamme: z.coerce.number().min(0).optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<FormValues>;
  productId?: string;
}

export function ProductFormDialog({ open, onOpenChange, defaultValues, productId }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!productId;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { unitPrice: 0, ...defaultValues },
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ['clients', 'all'],
    queryFn: () => apiRequest<any>('/clients?limit=200').then((r: any) => r.data),
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      isEdit
        ? apiRequest(`/codes-produits/${productId}`, { method: 'PATCH', body: JSON.stringify(data) })
        : apiRequest('/codes-produits', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['codes-produits'] });
      onOpenChange(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le code produit' : 'Nouveau code produit'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="code" render={({ field }) => (
                <FormItem>
                  <FormLabel>Code *</FormLabel>
                  <FormControl><Input placeholder="PLN-001" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="clientId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Client *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="designation" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Désignation *</FormLabel>
                  <FormControl><Input placeholder="Plan de masse RET pylône" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="productType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[['etude','Étude'],['plan','Plan'],['note_calcul','Note de calcul'],['releve','Relevé'],['doe','DOE'],['apd','APD'],['pdb','PDB'],['maj','Mise à jour'],['autre','Autre']].map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="unitType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Unité</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[['piece','Pièce'],['heure','Heure'],['forfait','Forfait'],['ml','ml'],['m2','m²']].map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="unitPrice" render={({ field }) => (
                <FormItem>
                  <FormLabel>Prix unitaire (€) *</FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="timeGamme" render={({ field }) => (
                <FormItem>
                  <FormLabel>Gamme (h/unité)</FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0" placeholder="2.5" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
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
