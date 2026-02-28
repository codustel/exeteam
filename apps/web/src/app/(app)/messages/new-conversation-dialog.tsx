'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagingApi } from '@/lib/api/messaging';
import { apiRequest } from '@/lib/api/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Search } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}

export function NewConversationDialog({ open, onOpenChange, onCreated }: Props) {
  const [isGroup, setIsGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => apiRequest<any>('/employees?limit=200').then((r: any) => r.data),
    enabled: open,
  });

  const filtered = (employees as any[]).filter(e =>
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()),
  );

  const mutation = useMutation({
    mutationFn: () => messagingApi.createConversation({
      name: isGroup ? groupName || undefined : undefined,
      isGroup,
      memberEmployeeIds: selectedIds,
    }),
    onSuccess: (conv: any) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      onCreated(conv.id);
      onOpenChange(false);
      setSelectedIds([]);
      setGroupName('');
      setSearch('');
    },
  });

  const toggle = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle conversation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={isGroup} onCheckedChange={setIsGroup} />
            <Label>Conversation de groupe</Label>
          </div>

          {isGroup && (
            <Input
              placeholder="Nom du groupe"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un employé..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
            {filtered.map((emp: any) => (
              <label key={emp.id} className="flex items-center gap-3 p-2 hover:bg-muted rounded cursor-pointer">
                <Checkbox
                  checked={selectedIds.includes(emp.id)}
                  onCheckedChange={() => toggle(emp.id)}
                />
                <span className="text-sm">{emp.firstName} {emp.lastName}</span>
              </label>
            ))}
          </div>

          {selectedIds.length > 0 && (
            <p className="text-xs text-muted-foreground">{selectedIds.length} employé(s) sélectionné(s)</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            disabled={selectedIds.length === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
