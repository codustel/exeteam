import { EmployeDashboardClient } from './employe-dashboard-client';

export const metadata = { title: "Dashboard Employé" };

interface Props {
  params: Promise<{ employeeId: string }>;
}

export default async function EmployeDashboardPage({ params }: Props) {
  const { employeeId } = await params;
  return <EmployeDashboardClient employeeId={employeeId} />;
}
