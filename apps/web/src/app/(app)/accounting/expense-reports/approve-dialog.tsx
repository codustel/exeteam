'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { expenseReportsApi } from '@/lib/api/accounting';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
  reportTitle: string;
  employeeName: string;
  amount: number;
}

export function ApproveDialog({ open, onOpenChange, reportId, reportTitle, employeeName, amount }: Props) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');

  const mutation = useMutation({
    mutationFn: (action: 'approuve' | 'refuse') =>
      expenseReportsApi.approve(reportId, { action, comment: comment || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-reports'] });
      onOpenChange(false);
      setComment('');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Approuver la note de frais</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-muted/50 p-3 space-y-1">
            <p className="text-sm font-medium">{reportTitle}</p>
            <p className="text-sm text-muted-foreground">
              {employeeName} — {amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Commentaire (optionnel)</label>
            <Textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ajouter un commentaire..."
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="destructive"
            onClick={() => mutation.mutate('refuse')}
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <XCircle className="h-4 w-4 mr-2" />
            Refuser
          </Button>
          <Button
            onClick={() => mutation.mutate('approuve')}
            disabled={mutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <CheckCircle className="h-4 w-4 mr-2" />
            Approuver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
