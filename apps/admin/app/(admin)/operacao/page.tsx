import { adminDb } from '@/lib/context';
import { getNetworkOperation } from '@leeva/shared/services';
import { OperationView } from './OperationView';

export const dynamic = 'force-dynamic';

export default async function Operacao() {
  const data = await getNetworkOperation(adminDb(), {});
  const { data: rests } = await adminDb().from('restaurants').select('id, name').limit(2000);
  const regions = [...new Set(data.activeOrders.map((o) => o.region).filter(Boolean))] as string[];
  return <OperationView initial={data as never} restaurants={(rests ?? []) as never} regions={regions} />;
}
