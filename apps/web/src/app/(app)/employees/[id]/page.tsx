import { Header } from '@/components/layout/header';
import { EmployeeDetail } from './employee-detail';

interface Props { params: Promise<{ id: string }> }

export default async function EmployeeDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <>
      <Header title="Profil employé" />
      <div className="p-6">
        <EmployeeDetail employeeId={id} />
      </div>
    </>
  );
}
