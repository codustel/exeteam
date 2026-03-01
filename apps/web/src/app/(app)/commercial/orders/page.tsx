import { Header } from '@/components/layout/header';
import { OrdersView } from './orders-view';

export const metadata = { title: 'Commandes' };

export default function OrdersPage() {
  return (
    <>
      <Header title="Commandes" />
      <div className="p-6 space-y-6">
        <OrdersView />
      </div>
    </>
  );
}
