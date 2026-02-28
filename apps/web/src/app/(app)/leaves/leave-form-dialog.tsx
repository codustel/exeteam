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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const schema = z.object({
  employeeId: z.string().uuid('Employé requis'),
  leaveTypeId: z.string().uuid('Type requis'),
  startDate: z.string().min(1, 'Requis'),
  endDate: z.string().min(1, 'Requis'),
  reason: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmployeeId?: string;
}

export function LeaveFormDialog({ open, onOpenChange, defaultEmployeeId }: Props) {
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { employeeId: defaultEmployeeId },
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ['employees', 'all'],
    queryFn: () => apiRequest<any>('/employees?limit=200&isActive=true').then((r: any) => r.data ?? []),
  });

  const { data: leaveTypes = [] } = useQuery<any[]>({
    queryKey: ['leaves', 'types'],
    queryFn: () => apiRequest<any[]>('/leaves/types'),
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) => apiRequest('/leaves', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      onOpenChange(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle demande de congé</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="employeeId" render={({ field }) => (
              <FormItem>
                <FormLabel>Employé *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                  <SelectContent>
                    {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="leaveTypeId" render={({ field }) => (
              <FormItem>
                <FormLabel>Type de congé *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                  <SelectContent>
                    {leaveTypes.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem><FormLabel>Date début *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem><FormLabel>Date fin *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="reason" render={({ field }) => (
              <FormItem>
                <FormLabel>Motif</FormLabel>
                <FormControl><Textarea placeholder="Motif de la demande..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Soumettre
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
