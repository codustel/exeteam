import { Header } from '@/components/layout/header';
import { SiteDetail } from './site-detail';

interface Props { params: Promise<{ id: string }> }

export default async function SiteDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <>
      <Header title="Site" />
      <div className="p-6">
        <SiteDetail siteId={id} />
      </div>
    </>
  );
}
