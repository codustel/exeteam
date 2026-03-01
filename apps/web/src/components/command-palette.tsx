'use client';

import { useEffect, useState, useCallback } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Building2, FolderKanban, CheckSquare, Users, MapPin, Search } from 'lucide-react';

interface SearchResults {
  clients: Array<{ id: string; name: string; code: string }>;
  projects: Array<{ id: string; name: string; reference: string }>;
  tasks: Array<{ id: string; title: string; reference: string }>;
  employees: Array<{ id: string; firstName: string; lastName: string }>;
  sites: Array<{ id: string; name: string; reference: string }>;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Toggle with Ctrl+K / Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/proxy/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          setResults(await res.json());
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const navigate = useCallback((path: string) => {
    setOpen(false);
    setQuery('');
    router.push(path);
  }, [router]);

  const hasResults = results && (
    results.clients.length > 0 ||
    results.projects.length > 0 ||
    results.tasks.length > 0 ||
    results.employees.length > 0 ||
    results.sites.length > 0
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 max-w-lg">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-input]]:h-12">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              placeholder="Rechercher clients, projets, tâches..."
              value={query}
              onValueChange={setQuery}
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            {loading && <Command.Loading>Recherche en cours...</Command.Loading>}

            {query.length >= 2 && !loading && !hasResults && (
              <Command.Empty>Aucun résultat trouvé.</Command.Empty>
            )}

            {results?.clients && results.clients.length > 0 && (
              <Command.Group heading="Clients">
                {results.clients.map((c) => (
                  <Command.Item key={c.id} onSelect={() => navigate(`/clients/${c.id}`)} className="flex items-center gap-2 cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{c.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{c.code}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {results?.projects && results.projects.length > 0 && (
              <Command.Group heading="Projets">
                {results.projects.map((p) => (
                  <Command.Item key={p.id} onSelect={() => navigate(`/projects/${p.id}`)} className="flex items-center gap-2 cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
                    <FolderKanban className="h-4 w-4 text-muted-foreground" />
                    <span>{p.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{p.reference}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {results?.tasks && results.tasks.length > 0 && (
              <Command.Group heading="Tâches">
                {results.tasks.map((t) => (
                  <Command.Item key={t.id} onSelect={() => navigate(`/tasks/${t.id}`)} className="flex items-center gap-2 cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
                    <CheckSquare className="h-4 w-4 text-muted-foreground" />
                    <span>{t.title}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{t.reference}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {results?.employees && results.employees.length > 0 && (
              <Command.Group heading="Employés">
                {results.employees.map((e) => (
                  <Command.Item key={e.id} onSelect={() => navigate(`/employees/${e.id}`)} className="flex items-center gap-2 cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{e.firstName} {e.lastName}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {results?.sites && results.sites.length > 0 && (
              <Command.Group heading="Sites">
                {results.sites.map((s) => (
                  <Command.Item key={s.id} onSelect={() => navigate(`/sites/${s.id}`)} className="flex items-center gap-2 cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{s.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{s.reference}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {!query && (
              <Command.Group heading="Actions rapides">
                <Command.Item onSelect={() => navigate('/clients')} className="flex items-center gap-2 cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
                  <Building2 className="h-4 w-4" />
                  <span>Voir tous les clients</span>
                </Command.Item>
                <Command.Item onSelect={() => navigate('/projects')} className="flex items-center gap-2 cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
                  <FolderKanban className="h-4 w-4" />
                  <span>Voir tous les projets</span>
                </Command.Item>
                <Command.Item onSelect={() => navigate('/tasks')} className="flex items-center gap-2 cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
                  <CheckSquare className="h-4 w-4" />
                  <span>Voir toutes les tâches</span>
                </Command.Item>
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
