'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { purchaseInvoicesApi, suppliersApi } from '@/lib/api/accounting';
import { VAT_RATES } from '@exeteam/shared';
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const schema = z.object({
  reference: z.string().min(1, 'Requis'),
  supplierId: z.string().min(1, 'Requis'),
  invoiceDate: z.string().min(1, 'Requis'),
  dueDate: z.string().optional().or(z.literal('')),
  totalHt: z.coerce.number().min(0, 'Doit être positif'),
  vatRate: z.coerce.number().min(0).max(100),
  notes: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<FormValues>;
  invoiceId?: string;
}

export function PurchaseInvoiceFormDialog({ open, onOpenChange, defaultValues, invoiceId }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!invoiceId;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { vatRate: 20, ...defaultValues },
  });

  useEffect(() => {
    if (open) {
      form.reset({ vatRate: 20, ...defaultValues });
    }
  }, [open, defaultValues, form]);

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers', 'list', { limit: 200 }],
    queryFn: () => suppliersApi.list({ limit: 200, isActive: true }),
    enabled: open,
  });

  const totalHt = form.watch('totalHt') || 0;
  const vatRate = form.watch('vatRate') || 0;
  const computed = useMemo(() => {
    const vatAmount = totalHt * (vatRate / 100);
    const totalTtc = totalHt + vatAmount;
    return { vatAmount, totalTtc };
  }, [totalHt, vatRate]);

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      isEdit
        ? purchaseInvoicesApi.update(invoiceId!, data)
        : purchaseInvoicesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      onOpenChange(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier la facture' : 'Nouvelle facture achat'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="reference" render={({ field }) => (
                <FormItem>
                  <FormLabel>Référence *</FormLabel>
                  <FormControl><Input placeholder="FA-2026-001" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="supplierId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fournisseur *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {suppliersData?.data.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="invoiceDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date facture *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="dueDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Échéance</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="totalHt" render={({ field }) => (
                <FormItem>
                  <FormLabel>Total HT (€) *</FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="vatRate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Taux TVA</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {VAT_RATES.map((rate) => (
                        <SelectItem key={rate.value} value={String(rate.value)}>
                          {rate.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="col-span-2 grid grid-cols-2 gap-4 rounded-md bg-muted/50 p-3">
                <div>
                  <p className="text-xs text-muted-foreground">TVA</p>
                  <p className="text-sm font-medium">{computed.vatAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total TTC</p>
                  <p className="text-sm font-medium">{computed.totalTtc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
                </div>
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea rows={3} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
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
