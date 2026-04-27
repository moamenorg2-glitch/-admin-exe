import { driverService } from './src/services/driverService.ts';
driverService.fetchDrivers(0, 10, { zone_id: 'all' }).then(res => console.log(JSON.stringify(res, null, 2))).catch(console.error);
