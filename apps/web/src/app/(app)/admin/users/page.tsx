import { Header } from '@/components/layout/header';
import { UsersTable } from './users-table';

export const metadata = { title: 'Gestion des utilisateurs' };

export default function AdminUsersPage() {
  return (
    <>
      <Header title="Utilisateurs" />
      <div className="p-6">
        <UsersTable />
      </div>
    </>
  );
}
