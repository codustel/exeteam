'use client';

import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';

export function UsersTable() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Utilisateurs</h2>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Inviter un utilisateur
        </Button>
      </div>
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        Interface complète disponible après Sprint 2 (Employees + Interlocuteurs)
      </div>
    </div>
  );
}
