import { orderService } from './src/services/orderService.ts';
orderService.fetchOrders(0, 5, { selectedStatuses: ['Active', 'OnTheWay'] }).then(res => {
  console.log(JSON.stringify(res.data, null, 2));
}).catch(console.error);
