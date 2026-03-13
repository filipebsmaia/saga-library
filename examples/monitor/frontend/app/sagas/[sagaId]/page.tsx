import { LiveDetail } from '@/components/detail/live-detail/live-detail';

interface Props {
  params: { sagaId: string };
}

export default function SagaDetailPage({ params }: Props) {
  return <LiveDetail sagaId={params.sagaId} />;
}
