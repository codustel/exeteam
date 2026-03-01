import { ClientDashboardClient } from './client-dashboard-client';

export const metadata = { title: 'Dashboard Client' };

interface Props {
  params: Promise<{ clientId: string }>;
}

export default async function ClientDashboardPage({ params }: Props) {
  const { clientId } = await params;
  return <ClientDashboardClient clientId={clientId} />;
}
