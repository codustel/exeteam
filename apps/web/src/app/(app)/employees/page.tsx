import { Header } from '@/components/layout/header';
import { EmployeesTable } from './employees-table';

export const metadata = { title: 'Employés' };

export default function EmployeesPage() {
  return (
    <>
      <Header title="Employés" />
      <div className="p-6 space-y-6">
        <EmployeesTable />
      </div>
    </>
  );
}
