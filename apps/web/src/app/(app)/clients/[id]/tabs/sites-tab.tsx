'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';
import Link from 'next/link';

interface Site {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  isActive: boolean;
}

interface Props { clientId: string }

export function SitesTab({ clientId }: Props) {
  const { data: sites = [], isLoading } = useQuery<Site[]>({
    queryKey: ['sites', 'client', clientId],
    queryFn: () => apiRequest<Site[]>(`/sites?clientId=${clientId}`),
  });

  if (isLoading) return <div className="text-muted-foreground text-sm">Chargement...</div>;

  if (sites.length === 0) {
    return <p className="text-muted-foreground text-sm">Aucun site associé</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {sites.map((site) => (
        <Link
          key={site.id}
          href={`/sites/${site.id}`}
          className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{site.name}</p>
                {site.city && <p className="text-sm text-muted-foreground">{site.city}</p>}
              </div>
            </div>
            <Badge variant={site.isActive ? 'default' : 'secondary'} className="text-xs">
              {site.isActive ? 'Actif' : 'Inactif'}
            </Badge>
          </div>
        </Link>
      ))}
    </div>
  );
}
