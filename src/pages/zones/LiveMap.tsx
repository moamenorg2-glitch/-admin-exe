import { useState, useEffect, useMemo } from 'react';
import { Map as MapIcon, Activity, Users, Car } from 'lucide-react';
import OpenLayerMap from '../../components/map/OpenLayerMap';
import { driverService } from '../../services/driverService';
import { vendorService } from '../../services/vendorService';
import { orderService } from '../../services/orderService';
import { supabase } from '../../lib/supabase';
import { useSearchParams } from 'react-router-dom';
import { cn } from '../../lib/utils';

const INITIAL_CENTER: [number, number] = [31.2357, 30.0444]; // Cairo [lng, lat]

interface LiveMapProps {
  embedded?: boolean;
  initialType?: 'all' | 'driver' | 'order' | 'vendor';
  initialId?: string;
  initialZone?: string;
  hideControls?: boolean;
}

export default function LiveMap({ embedded = false, initialType = 'all', initialId = '', initialZone = 'all', hideControls = false }: LiveMapProps = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [markers, setMarkers] = useState<any[]>([]);
  
  // Initialize from props or URL params
  const [filterType, setFilterType] = useState<'all' | 'driver' | 'order' | 'vendor'>(
    embedded ? initialType : ((searchParams.get('type') as any) || 'all')
  );
  const [filterId, setFilterId] = useState<string>(embedded ? initialId : (searchParams.get('id') || ''));
  const [selectedZoneId, setSelectedZoneId] = useState<string>(embedded ? initialZone : (searchParams.get('zone') || 'all'));
  const [zones, setZones] = useState<any[]>([]);

  const [trackedOrderNumber, setTrackedOrderNumber] = useState<number | null>(null);

  // If embedded, update state when props change
  useEffect(() => {
    if (embedded) {
      setFilterType(initialType);
      setFilterId(initialId);
      setSelectedZoneId(initialZone);
    }
  }, [embedded, initialType, initialId, initialZone]);

  // Sync state with URL params on mount or when params change (standalone mode)
  useEffect(() => {
    if (embedded) return;
    const type = searchParams.get('type') as any;
    const id = searchParams.get('id');
    const zone = searchParams.get('zone');

    if (type && type !== filterType) setFilterType(type);
    if (id && id !== filterId) setFilterId(id);
    if (zone && zone !== selectedZoneId) setSelectedZoneId(zone);
  }, [searchParams, embedded]);

  // Update URL params only when user explicitly changes state via UI
  // We'll use a separate set of functions or just rely on the UI actions
  const updateFilters = (newType: any, newId: string, newZone: string) => {
    if (embedded) {
      setFilterType(newType);
      setFilterId(newId);
      setSelectedZoneId(newZone);
      return;
    }
    const params: any = {};
    if (newType !== 'all') params.type = newType;
    if (newId) params.id = newId;
    if (newZone !== 'all') params.zone = newZone;
    setSearchParams(params);
  };

  const filteredMarkers = useMemo(() => {
    if (filterType === 'all' || !filterId) return markers;
    
    // Find the selected marker to get its orders
    const selectedMarker = markers.find(m => m.id === filterId);
    
    // Fallbacks if selectedMarker is missing
    let selectedOrders = new Set<number>();
    
    if (selectedMarker && selectedMarker.orders) {
      selectedOrders = selectedMarker.orders;
    } else if (filterType === 'order' && trackedOrderNumber !== null) {
      selectedOrders = new Set([trackedOrderNumber]);
    } else {
      return [];
    }

    return markers.filter(m => {
      // Show the selected one itself
      if (m.id === filterId) return true;

      // Show related markers if they share any orders
      if (m.orders) {
        for (const orderNum of m.orders) {
          if (selectedOrders.has(orderNum)) return true;
        }
      }
      return false;
    });
  }, [markers, filterType, filterId, trackedOrderNumber]);

  const activeCenter = useMemo(() => {
    if (filterType !== 'all' && filterId) {
      const target = markers.find(m => m.id === filterId);
      if (target) return [target.lng, target.lat] as [number, number];
      
      // If no direct marker target, try to find a related driver or vendor
      if (filterType === 'order' && trackedOrderNumber) {
        const related = markers.find(m => m.orders?.has(trackedOrderNumber));
        if (related) return [related.lng, related.lat] as [number, number];
      }
    }
    
    if (selectedZoneId && selectedZoneId !== 'all') {
      const zone = zones.find(z => z.zone_id === selectedZoneId);
      if (zone) {
        let latContext = null;
        let lngContext = null;
        
        if (zone.centroid && zone.centroid.type === 'Point' && Array.isArray(zone.centroid.coordinates)) {
          lngContext = zone.centroid.coordinates[0];
          latContext = zone.centroid.coordinates[1];
        } else {
          const pointStr = zone.center_point || zone.location_gps || zone.center;
          if (typeof pointStr === 'string' && pointStr.includes(',')) {
            const parts = pointStr.split(',').map(s => parseFloat(s.trim()));
            if (!isNaN(parts[0]) && !isNaN(parts[1])) {
              latContext = parts[0];
              lngContext = parts[1];
            }
          } else if (zone.center_lat && zone.center_lng) {
            latContext = parseFloat(zone.center_lat);
            lngContext = parseFloat(zone.center_lng);
          } else if (zone.lat && zone.lng) {
            latContext = parseFloat(zone.lat);
            lngContext = parseFloat(zone.lng);
          }
        }

        if (latContext !== null && lngContext !== null) {
           return [lngContext, latContext] as [number, number];
        }
      }
    }
    return INITIAL_CENTER;
  }, [markers, filterType, filterId, selectedZoneId, zones]);

  const activeZones = useMemo(() => {
    if (selectedZoneId === 'all') {
      return zones;
    }
    return zones.filter(z => z.zone_id === selectedZoneId);
  }, [selectedZoneId, zones]);

  useEffect(() => {
    const fetchZones = async () => {
      try {
        const { data } = await supabase.from('zones').select('*').eq('is_active', true);
        if (data) setZones(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchZones();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const fetchFilters: any = { zone_id: selectedZoneId };
        
        // If we are strictly tracking a single driver, fetch them explicitly 
        // to bypass the 'online' filter and ensure they appear.
        if (filterType === 'driver' && filterId) {
          fetchFilters.user_id = filterId;
          fetchFilters.status = 'all';
        } else {
          fetchFilters.status = 'online';
        }

        let orderStatuses = ['Active', 'OnTheWay'];
        if (filterType === 'order' && filterId) {
          orderStatuses = []; // fetch all statuses for that specific order if we're searching by ID
          // We'll pass it to searchQuery, or if orderService supports `id`, that is better.
        }

        const [driversRes, vendorsRes, ordersRes] = await Promise.all([
          driverService.fetchDrivers(0, 500, fetchFilters),
          vendorService.fetchVendors(0, 500, { zone_id: selectedZoneId }),
          orderService.fetchOrders(0, 500, filterType === 'order' && filterId ? { orderId: filterId } : { selectedStatuses: orderStatuses })
        ]);

        const realMarkers: any[] = [];
        const driversMap = new Map();
        const vendorsMap = new Map();
        const customersMap = new Map();

        const parseLocation = (locObj: any) => {
          if (!locObj) return null;
          let lat, lng;
          if (locObj.location) {
            return parseLocation(locObj.location);
          }
          if (locObj.type === 'Point' && Array.isArray(locObj.coordinates)) {
            lng = locObj.coordinates[0];
            lat = locObj.coordinates[1];
          } else if (typeof locObj === 'string') {
            const parts = locObj.split(',');
            if (parts.length === 2) {
              lat = parseFloat(parts[0]);
              lng = parseFloat(parts[1]);
            }
          } else if (typeof locObj === 'object') {
            lat = typeof locObj.lat === 'number' ? locObj.lat : (Array.isArray(locObj) ? locObj[1] : 0);
            lng = typeof locObj.lng === 'number' ? locObj.lng : (Array.isArray(locObj) ? locObj[0] : 0);
          }
          if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
            return { lat, lng };
          }
          return null;
        };

        // Drivers
        driversRes.drivers?.forEach((d: any) => {
          let locObj = d.location;
          if (Array.isArray(locObj)) locObj = locObj[0];
          
          const coords = parseLocation(locObj);
          if (coords) {
            driversMap.set(d.user_id, {
              id: d.user_id,
              lat: coords.lat,
              lng: coords.lng,
              type: 'driver',
              title: d.profile?.full_name || 'سائق غير معروف',
              phone: d.profile?.primary_phone,
              info: d.vehicle_type ? `المركبة: ${d.vehicle_type} | لوحة: ${d.license_plate || '-'}` : '',
              address: d.zone?.name_ar ? `منطقة العمل: ${d.zone.name_ar}` : 'جاري التتبع المباشر',
              orders: new Set<number>()
            });
          } else if (filterType === 'driver' && filterId === d.user_id) {
             console.warn('Driver tracking: no location found for driver', d.user_id);
          }
        });

        // Vendors
        vendorsRes.vendors?.forEach((v: any) => {
          const coords = parseLocation(v.location_gps);
          if (coords) {
            vendorsMap.set(v.user_id, {
              id: v.user_id,
              lat: coords.lat,
              lng: coords.lng,
              type: 'vendor',
              title: v.brand_name || v.profile?.full_name || 'متجر غير معروف',
              phone: v.profile?.primary_phone,
              address: v.landmark || 'العنوان غير محدد',
              orders: new Set<number>()
            });
          }
        });

        // Orders
        let foundOrderNumber: number | null = null;
        ordersRes.data?.forEach((o: any) => {
          if (filterType === 'order' && filterId === o.id) {
            foundOrderNumber = o.order_number;
          }

          const vendorZoneId = o.sub_orders?.[0]?.vendor?.zone_id;
          if (selectedZoneId !== 'all' && vendorZoneId !== selectedZoneId) {
            return;
          }

          // Augment Vendor
          o.sub_orders?.forEach((so: any) => {
             const vId = so.vendor?.user_id;
             if (vId) {
               if (vendorsMap.has(vId)) {
                 vendorsMap.get(vId).orders.add(o.order_number);
               } else {
                 const coords = parseLocation(so.vendor?.location_gps);
                 if (coords) {
                   vendorsMap.set(vId, {
                     id: vId,
                     lat: coords.lat,
                     lng: coords.lng,
                     type: 'vendor',
                     title: so.vendor?.brand_name || 'متجر غير معروف',
                     phone: so.vendor?.profiles?.primary_phone,
                     address: so.vendor?.landmark || 'العنوان غير محدد',
                     orders: new Set<number>([o.order_number])
                   });
                 }
               }
             }
          });

          // Augment Driver
          o.delivery_team?.forEach((dt: any) => {
             const dId = dt.driver_id;
             if (dId) {
               if (driversMap.has(dId)) {
                 driversMap.get(dId).orders.add(o.order_number);
               } else {
                 let dLoc = dt.driver?.driver_location;
                 if (Array.isArray(dLoc)) dLoc = dLoc[0];

                 const coords = parseLocation(dLoc);
                 if (coords) {
                   driversMap.set(dId, {
                     id: dId,
                     lat: coords.lat,
                     lng: coords.lng,
                     type: 'driver',
                     title: dt.driver?.user?.full_name || 'سائق غير معروف',
                     phone: dt.driver?.user?.primary_phone,
                     info: '',
                     address: 'جاري التتبع المباشر',
                     orders: new Set<number>([o.order_number])
                   });
                 }
               }
             }
          });

          // Customer marker
          const customerCoords = parseLocation(o.address?.location_gps);
          if (customerCoords) {
            customersMap.set(o.id, {
              id: o.id,
              lat: customerCoords.lat,
              lng: customerCoords.lng,
              type: 'order',
              status: o.status,
              isDelayed: o.status === 'Pending' || o.status === 'Active', // Simplifying logic for map indicator
              title: `${o.customer?.full_name || 'عميل غير معروف'} (#${o.order_number})`,
              phone: o.customer?.primary_phone,
              address: [
                  o.address?.city,
                  o.address?.district,
                  o.address?.street_name ? `شارع ${o.address.street_name}` : null,
                  o.address?.building_number ? `عقار ${o.address.building_number}` : null,
                  o.address?.floor_number ? `الطابق ${o.address.floor_number}` : null,
                  o.address?.apartment_num ? `شقة ${o.address.apartment_num}` : null,
                  o.address?.landmark ? `(علامة: ${o.address.landmark})` : null
                ].filter(Boolean).join(' - ') || 'العنوان غير محدد',
                orders: new Set<number>([o.order_number])
              });
            }
        });

        // Build final realMarkers
        for (const v of vendorsMap.values()) {
          const t = v.orders.size > 0 ? `${v.title} (#${Array.from(v.orders).join(', ')})` : v.title;
          realMarkers.push({ ...v, title: t });
        }
        for (const d of driversMap.values()) {
          const t = d.orders.size > 0 ? `${d.title} (#${Array.from(d.orders).join(', ')})` : d.title;
          realMarkers.push({ ...d, title: t });
        }
        for (const c of customersMap.values()) {
          realMarkers.push(c);
        }

        setMarkers(prev => JSON.stringify(realMarkers) !== JSON.stringify(prev) ? realMarkers : prev);
        
        if (filterType === 'order') {
          setTrackedOrderNumber(foundOrderNumber);
        } else {
          setTrackedOrderNumber(null);
        }
      } catch (err) {
        console.error('Error fetching live map data:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [selectedZoneId, filterType, filterId]);


  return (
    <div className={cn("w-full relative overflow-hidden flex flex-col", hideControls ? "h-full" : "pb-6")} dir="rtl">
      {/* Header */}
      {!hideControls && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-4 lg:px-0 shrink-0 py-4 lg:py-0">
          <div className="flex items-center gap-4">
            <div className="p-2.5 lg:p-3.5 bg-blue-100 rounded-2xl shadow-sm">
              <Activity className="w-5 h-5 lg:w-7 lg:h-7 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl lg:text-3xl font-extrabold text-gray-900 tracking-tight">الخريطة المباشرة</h2>
              <p className="hidden lg:block mt-1 text-gray-500 font-medium text-sm">تتبع حي للمتاجر، الطلبات النشطة، وأسطول السائقين.</p>
            </div>
          </div>
          
          {/* Quick Stats - More compact on mobile */}
          <div className="flex gap-2 lg:gap-4 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
             <div className="bg-white border border-gray-100 p-2 lg:p-3 rounded-xl shadow-sm text-center flex-1 min-w-[80px] lg:min-w-[100px]">
               <div className="text-lg lg:text-xl font-black text-blue-600 font-mono">
                 {markers.filter(m => m.type === 'driver').length}
               </div>
               <div className="text-[11px] lg:text-xs text-gray-500 font-bold flex items-center justify-center gap-1">
                 <Car className="w-3 h-3" /> متصل
               </div>
             </div>
               <div className="bg-white border border-gray-100 p-2 lg:p-3 rounded-xl shadow-sm text-center flex-1 min-w-[80px] lg:min-w-[100px]">
                 <div className="text-lg lg:text-xl font-black text-red-600 font-mono">
                   {markers.filter(m => m.type === 'order').length}
                 </div>
                 <div className="text-[11px] lg:text-xs text-gray-500 font-bold flex items-center justify-center gap-1">
                   <MapIcon className="w-3 h-3" /> عملاء
                 </div>
               </div>
             <div className="bg-white border border-gray-100 p-2 lg:p-3 rounded-xl shadow-sm text-center flex-1 min-w-[80px] lg:min-w-[100px]">
               <div className="text-lg lg:text-xl font-black text-emerald-600 font-mono">
                 {markers.filter(m => m.type === 'vendor').length}
               </div>
               <div className="text-[11px] lg:text-xs text-gray-500 font-bold flex items-center justify-center gap-1">
                 <Users className="w-3 h-3" /> متاجر
               </div>
             </div>
          </div>
        </div>
      )}

      {/* Filters Container - Sticky on mobile? No, just more compact */}
      {!hideControls && (
        <div className="bg-white p-3 lg:p-4 rounded-xl lg:rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 lg:gap-4 shrink-0 mx-4 lg:mx-0 mt-2 lg:mt-4 overflow-x-auto no-scrollbar mb-4">
          <label className="text-xs lg:text-sm font-semibold text-gray-700 whitespace-nowrap">المنطقة:</label>
          <select 
            value={selectedZoneId} 
            onChange={(e) => {
              const val = e.target.value;
              setSelectedZoneId(val);
              updateFilters(filterType, filterId, val);
            }}
            className="border border-gray-200 rounded-lg p-1.5 lg:p-2 text-xs lg:text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="all">كل المناطق</option>
            {zones.map(z => (
              <option key={z.zone_id} value={z.zone_id}>{z.name_ar}</option>
            ))}
          </select>

          <div className="h-4 lg:h-6 w-px bg-gray-200 mx-1 lg:mx-2"></div>

          <label className="text-xs lg:text-sm font-semibold text-gray-700 whitespace-nowrap">تتبع:</label>
          <select 
            value={filterType} 
            onChange={(e) => {
              const val = e.target.value as any;
              setFilterType(val);
              setFilterId('');
              updateFilters(val, '', selectedZoneId);
            }}
            className="border border-gray-200 rounded-lg p-1.5 lg:p-2 text-xs lg:text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="all">الكل</option>
            <option value="driver">سائق</option>
            <option value="order">طلب</option>
            <option value="vendor">متجر</option>
          </select>

          {filterType !== 'all' && (
            <select 
              value={filterId}
              onChange={(e) => {
                const val = e.target.value;
                setFilterId(val);
                updateFilters(filterType, val, selectedZoneId);
              }}
              className="border border-gray-200 rounded-lg p-1.5 lg:p-2 text-xs lg:text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none min-w-[120px] lg:min-w-[200px]"
            >
              <option value="">-- اختر --</option>
              {markers.filter(m => m.type === filterType).map(m => (
                <option key={m.id} value={m.id}>{m.title}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Map Container - Must have enough height/flex to show up */}
      <div className={cn(
        "w-full relative flex-1 min-h-[400px] h-[400px] shrink-0", 
        !hideControls && "px-4 lg:px-0"
      )}>
        <div className={cn(
          "w-full h-full relative overflow-hidden",
          !hideControls && "rounded-2xl bg-white shadow-xl border border-gray-100"
        )}>
           <OpenLayerMap 
              markers={filteredMarkers} 
              center={activeCenter} 
              trackingId={filterId || selectedZoneId} 
              zoom={filterId && filterType !== 'order' ? 17 : 13} 
              zones={activeZones} 
              autoFit={!filterId || filterType === 'order'} 
            />
        </div>
      </div>
    </div>
  );
}
