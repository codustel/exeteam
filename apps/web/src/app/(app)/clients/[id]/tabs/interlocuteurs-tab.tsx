'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { InterlocuteurFormDialog } from './interlocuteur-form-dialog';

interface Props { clientId: string }

interface Interlocuteur {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  fonction: string | null;
  isActive: boolean;
  user: { id: string; email: string; isActive: boolean } | null;
}

const FONCTION_LABELS: Record<string, string> = {
  chef_projet: 'Chef de projet',
  charge_affaire: "Chargé d'affaires",
  resp_be: 'Resp. BE',
  autre: 'Autre',
};

export function InterlocuteursTab({ clientId }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: interlocuteurs = [], isLoading } = useQuery<Interlocuteur[]>({
    queryKey: ['interlocuteurs', clientId],
    queryFn: () => apiRequest<Interlocuteur[]>(`/interlocuteurs?clientId=${clientId}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/interlocuteurs/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['interlocuteurs', clientId] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Interlocuteurs ({interlocuteurs.length})</h3>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Chargement...</div>
      ) : interlocuteurs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Aucun interlocuteur</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Fonction</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Compte</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {interlocuteurs.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.firstName} {i.lastName}</TableCell>
                <TableCell>{i.fonction ? FONCTION_LABELS[i.fonction] ?? i.fonction : '—'}</TableCell>
                <TableCell>{i.email ?? '—'}</TableCell>
                <TableCell>{i.phone ?? '—'}</TableCell>
                <TableCell>
                  {i.user ? (
                    <Badge variant={i.user.isActive ? 'default' : 'secondary'} className="text-xs">
                      Compte actif
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sans compte</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(i.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <InterlocuteurFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        clientId={clientId}
      />
    </div>
  );
}
