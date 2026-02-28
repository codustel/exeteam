'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Search, Building, Edit, Trash2, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';

const schema = z.object({
  name: z.string().min(1, 'Requis'),
  description: z.string().optional(),
  contact: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function OperatorForm({ onSuccess, defaultValues, operatorId }: {
  onSuccess: () => void;
  defaultValues?: Partial<FormValues>;
  operatorId?: string;
}) {
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      operatorId
        ? apiRequest(`/operators/${operatorId}`, { method: 'PATCH', body: JSON.stringify(data) })
        : apiRequest('/operators', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operators'] });
      onSuccess();
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Nom *</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="contact" render={({ field }) => (
          <FormItem>
            <FormLabel>Contact</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <DialogFooter>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {operatorId ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export default function OperatorsPage() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editOperator, setEditOperator] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: operators = [], isLoading } = useQuery<any[]>({
    queryKey: ['operators', search],
    queryFn: () => apiRequest<any[]>(`/operators${search ? `?search=${search}` : ''}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/operators/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operators'] }),
  });

  return (
    <>
      <Header title="Opérateurs" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => { setEditOperator(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvel opérateur
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Chargement...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {operators.map((op: any) => (
              <Card key={op.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Building className="h-4 w-4 text-primary" />
                    {op.name}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => { setEditOperator(op); setDialogOpen(true); }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(op.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {op.description && <p className="text-sm text-muted-foreground">{op.description}</p>}
                  <div className="flex gap-3 mt-2 text-sm text-muted-foreground">
                    <span>{op._count?.clients ?? 0} clients</span>
                    <span>{op._count?.sites ?? 0} sites</span>
                    <span>{op._count?.projects ?? 0} projets</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editOperator ? "Modifier l'opérateur" : 'Nouvel opérateur'}</DialogTitle>
            </DialogHeader>
            <OperatorForm
              operatorId={editOperator?.id}
              defaultValues={editOperator}
              onSuccess={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
