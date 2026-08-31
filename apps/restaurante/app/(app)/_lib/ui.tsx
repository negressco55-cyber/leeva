import type { OrderStatus, OrderSource } from '@leeva/shared';
import { ORDER_STATUS_LABELS, ORDER_SOURCE_LABELS } from '@leeva/shared/constants';

const STATUS_COLOR: Record<OrderStatus, string> = {
  waiting_dispatch: 'amber',
  preparing: 'blue',
  ready: 'orange',
  assigned: 'blue',
  picked_up: 'blue',
  in_route: 'green',
  delivered: 'gray',
  cancelled: 'red',
};

export function StatusPill({ status }: { status: OrderStatus }) {
  return <span className={`pill ${STATUS_COLOR[status]}`}>{ORDER_STATUS_LABELS[status]}</span>;
}

export function SourcePill({ source }: { source: OrderSource }) {
  return <span className="pill gray">{ORDER_SOURCE_LABELS[source]}</span>;
}
