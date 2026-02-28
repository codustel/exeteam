import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PortalDemandsClient } from './portal-demands-client';

export const metadata = { title: 'Mes demandes — Espace Client' };

export default async function PortalDemandsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  /**
   * In production: query the NestJS API to resolve
   * the logged-in user's interlocuteurId → clientId + default projectId.
   * For now, we pass placeholder values that will be replaced when the
   * interlocuteur session data is wired up in Sprint 3A.
   */
  const clientId = user.user_metadata?.clientId ?? '';
  const projectId = user.user_metadata?.projectId ?? '';

  if (!clientId || !projectId) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">
          Votre compte n&apos;est pas encore associé à un client.
          Contactez votre administrateur.
        </p>
      </div>
    );
  }

  return <PortalDemandsClient clientId={clientId} projectId={projectId} />;
}
