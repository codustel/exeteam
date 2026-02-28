'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const schema = z.object({
  firstName: z.string().min(1, 'Requis'),
  lastName: z.string().min(1, 'Requis'),
  professionalEmail: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  position: z.string().optional(),
  contractType: z.enum(['cdi', 'cdd', 'stage', 'freelance', 'alternance']).optional(),
  entryDate: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<FormValues>;
  employeeId?: string;
}

export function EmployeeFormDialog({ open, onOpenChange, defaultValues, employeeId }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!employeeId;
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });

  const { data: departments = [] } = useQuery<any[]>({
    queryKey: ['employees', 'departments'],
    queryFn: () => apiRequest<any[]>('/employees/departments'),
  });

  const { data: managers = [] } = useQuery<any[]>({
    queryKey: ['employees', 'managers'],
    queryFn: () => apiRequest<any>('/employees?limit=200&isActive=true').then((r: any) => r.data ?? []),
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const body = { ...data, entryDate: data.entryDate ? new Date(data.entryDate).toISOString() : undefined };
      return isEdit
        ? apiRequest(`/employees/${employeeId}`, { method: 'PATCH', body: JSON.stringify(body) })
        : apiRequest('/employees', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      onOpenChange(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'employé" : 'Nouvel employé'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="firstName" render={({ field }) => (
                <FormItem><FormLabel>Prénom *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="lastName" render={({ field }) => (
                <FormItem><FormLabel>Nom *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="professionalEmail" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Email professionnel</FormLabel>
                  <FormControl><Input type="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="position" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Poste</FormLabel>
                  <FormControl><Input placeholder="Ingénieur BE" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contractType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type contrat</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {[['cdi','CDI'],['cdd','CDD'],['stage','Stage'],['freelance','Freelance'],['alternance','Alternance']].map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="entryDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date d'entrée</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="departmentId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Département</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="managerId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsable (N+1)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {managers.map((e: any) => (
                        <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
