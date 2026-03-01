import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-background">
      {/* Portal header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: '#FF6600' }}>
              ET
            </div>
            <span className="font-semibold text-foreground">Espace Client ExeTeam</span>
          </div>
          <a href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Déconnexion
          </a>
        </div>
      </header>
      {/* Portal content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
