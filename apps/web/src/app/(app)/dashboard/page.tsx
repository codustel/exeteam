import { Header } from '@/components/layout/header';

export const metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <>
      <Header title="Dashboard" />
      <div className="p-6">
        <p className="text-muted-foreground">Dashboard en cours de construction — Sprint 4</p>
      </div>
    </>
  );
}
