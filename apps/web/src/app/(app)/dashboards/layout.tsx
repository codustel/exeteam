import { Header } from '@/components/layout/header';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';

export default function DashboardsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header title="Tableaux de bord" />
      <DashboardLayout>{children}</DashboardLayout>
    </>
  );
}
