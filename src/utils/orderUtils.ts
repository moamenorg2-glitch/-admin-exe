import { differenceInMinutes } from 'date-fns';

export const getDelayStatus = (order: any, now: Date, PREP_THRESHOLD: number, DELIVERY_THRESHOLD: number) => {
  const history = order.sub_orders?.flatMap((so: any) => so.order_status_history || []) || [];
  history.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  
  const createdAt = new Date(order.created_at);
  const isFinished = ['Completed', 'Cancelled', 'Rejected'].includes(order.status);
  
  const activeEntry = history.find((h: any) => h.status === 'Active');
  const onTheWayEntry = history.find((h: any) => ['OnTheWay', 'PickedUp'].includes(h.status));
  const completedEntry = history.find((h: any) => ['Completed', 'Cancelled', 'Rejected', 'Delivered'].includes(h.status));
  
  const activeTime = activeEntry ? new Date(activeEntry.created_at) : createdAt;
  const onTheWayTime = onTheWayEntry ? new Date(onTheWayEntry.created_at) : (['OnTheWay', 'PickedUp'].includes(order.status) ? new Date(order.updated_at) : null);
  const endTime = completedEntry ? new Date(completedEntry.created_at) : (isFinished ? new Date(order.updated_at) : now);
  
  let prepElapsed = 0;
  let deliveryElapsed = 0;

  if (order.status === 'Pending') {
    prepElapsed = 0;
    deliveryElapsed = 0;
  } else if (order.status === 'Active') {
    prepElapsed = differenceInMinutes(now, activeTime);
    deliveryElapsed = 0;
  } else if (onTheWayTime) {
    prepElapsed = differenceInMinutes(onTheWayTime, activeTime);
    deliveryElapsed = differenceInMinutes(endTime, onTheWayTime);
  } else {
    prepElapsed = differenceInMinutes(endTime, activeTime);
    deliveryElapsed = 0;
  }

  let isDelayed = false;
  let type = 'none';

  // Use sub_order prep time override if available, otherwise fallback to global threshold
  const maxVendorPrep = Math.max(...(order.sub_orders?.map((s: any) => s.preparation_time_override || s.vendor?.preparation_time_avg || PREP_THRESHOLD) || [PREP_THRESHOLD]));

  if (order.status === 'Active' && prepElapsed > maxVendorPrep) {
    isDelayed = true;
    type = 'prep';
  } else if (order.status === 'OnTheWay' && deliveryElapsed > DELIVERY_THRESHOLD) {
    isDelayed = true;
    type = 'delivery';
  }

  return { isDelayed, type, prepElapsed, deliveryElapsed, maxVendorPrep };
};
