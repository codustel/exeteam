import { Header } from '@/components/layout/header';
import { ProductsTable } from './products-table';

export const metadata = { title: 'Codes Produits' };

export default function ProductsPage() {
  return (
    <>
      <Header title="Codes Produits" />
      <div className="p-6 space-y-6">
        <ProductsTable />
      </div>
    </>
  );
}
