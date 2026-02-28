'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Mail, Phone } from 'lucide-react';
import { InterlocuteurFormDialog } from './interlocuteur-form-dialog';

interface Interlocuteur {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  fonction: string | null;
  isPrincipal: boolean;
}

interface Props { clientId: string }

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

  if (isLoading) return <div className="text-muted-foreground text-sm">Chargement...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un contact
        </Button>
      </div>

      {interlocuteurs.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun contact enregistré</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {interlocuteurs.map((i) => (
            <div key={i.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{i.firstName} {i.lastName}</p>
                  {i.fonction && <p className="text-sm text-muted-foreground">{i.fonction}</p>}
                </div>
                <div className="flex items-center gap-1">
                  {i.isPrincipal && <Badge>Principal</Badge>}
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(i.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                {i.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" />
                    <a href={`mailto:${i.email}`} className="hover:text-foreground">{i.email}</a>
                  </div>
                )}
                {i.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" />
                    <a href={`tel:${i.phone}`} className="hover:text-foreground">{i.phone}</a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <InterlocuteurFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        clientId={clientId}
      />
    </div>
  );
}
