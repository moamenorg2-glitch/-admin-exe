import { useEffect, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  ShoppingBag, 
  DollarSign, 
  Users, 
  Clock, 
  TrendingUp, 
  Package, 
  Truck, 
  Activity,
  AlertCircle,
  Search,
  ChevronDown,
  Navigation,
  CheckCircle2,
  Map as MapIcon,
  Timer
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAuthStore } from '../store/authStore';
import { cn } from '../lib/utils';
import { dashboardService } from '../services/dashboardService';
import { handleGlobalError } from '../utils/errorHandler';
import { supabase } from '../lib/supabase';

// OpenLayers imports
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { Style, Circle as CircleStyle, Fill, Stroke } from 'ol/style';

// OpenLayers CSS
import 'ol/ol.css';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard-data'],
    queryFn: async () => {
      try {
        return await dashboardService.fetchDashboardData();
      } catch (error) {
        handleGlobalError(error, 'Fetch Dashboard Data');
        throw error;
      }
    },
    refetchInterval: 30000,
  });

  // Fetch zones/vendors for map
  const { data: mapLocations } = useQuery({
    queryKey: ['map-locations'],
    queryFn: async () => {
      const [{ data: vendors }, { data: zones }] = await Promise.all([
        supabase
          .from('vendor_details')
          .select('brand_name, location_gps')
          .not('location_gps', 'is', null),
        supabase
          .from('zones')
          .select('name_ar, centroid, boundary')
          .eq('is_active', true)
      ]);
      return { vendors: vendors || [], zones: zones || [] };
    }
  });

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM({
            url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          }),
        }),
      ],
      view: new View({
        center: fromLonLat([31.2357, 30.0444]), // Cairo
        zoom: 12,
      }),
      controls: [],
    });

    mapInstance.current = map;

    return () => {
      if (mapInstance.current) {
        mapInstance.current.setTarget(undefined);
        mapInstance.current = null;
      }
    };
  }, []);

  // Update map markers when data changes
  useEffect(() => {
    if (!mapInstance.current || !mapLocations) return;

    const vectorSource = new VectorSource();
    
    // Add Vendors
    (mapLocations.vendors || []).forEach((loc: any) => {
      if (loc.location_gps?.latitude && loc.location_gps?.longitude) {
        const feature = new Feature({
          geometry: new Point(fromLonLat([loc.location_gps.longitude, loc.location_gps.latitude])),
          name: loc.brand_name
        });
        feature.setStyle(new Style({
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: '#10b981' }),
            stroke: new Stroke({ color: '#fff', width: 2 }),
          })
        }));
        vectorSource.addFeature(feature);
      }
    });

    // Add Zones as centroids for now
    (mapLocations.zones || []).forEach((zone: any) => {
      if (zone.centroid?.latitude && zone.centroid?.longitude) {
        const feature = new Feature({
          geometry: new Point(fromLonLat([zone.centroid.longitude, zone.centroid.latitude])),
          name: zone.name_ar
        });
        feature.setStyle(new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({ color: '#3b82f6' }),
            stroke: new Stroke({ color: '#fff', width: 2 }),
          })
        }));
        vectorSource.addFeature(feature);
      }
    });

    const vectorLayer = new VectorLayer({
      source: vectorSource,
    });

    // Remove old vector layers
    mapInstance.current.getLayers().getArray()
      .filter((l: any) => l instanceof VectorLayer)
      .forEach((l: any) => mapInstance.current.removeLayer(l));

    mapInstance.current.addLayer(vectorLayer);
  }, [mapLocations]);

  // Sync map theme
  useEffect(() => {
    if (!mapInstance.current) return;
    
    const updateMapTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      const layers = mapInstance.current.getLayers().getArray();
      const tileLayer = layers.find((l: any) => l instanceof TileLayer && l.getSource() instanceof OSM);
      if (tileLayer) {
        tileLayer.setSource(new OSM({
          url: isDark 
            ? 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        }));
      }
    };

    updateMapTheme();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          updateMapTheme();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, [isLoading]);

  const kpiCards = [
    { 
      id: 'total-orders',
      title: 'إجمالي الطلبات اليوم', 
      value: dashboardData?.stats?.ordersToday || 0, 
      trend: '+12%',
      trendUp: true,
      icon: Package,
      color: 'emerald'
    },
    { 
      id: 'active-riders',
      title: 'المناديب النشطين', 
      value: `${(dashboardData?.stats?.availableDrivers || 0) + (dashboardData?.stats?.busyDrivers || 0)} / ${dashboardData?.stats?.totalDrivers || 0}`, 
      trend: 'متصل الآن',
      trendUp: true,
      icon: Truck,
      color: 'blue'
    },
    { 
      id: 'revenue',
      title: 'الديون / المبالغ المستحقة', 
      value: `${dashboardData?.stats?.revenueToday?.toLocaleString() || 0} ج.م`, 
      trend: 'اليوم',
      trendUp: true,
      icon: DollarSign,
      color: 'amber'
    },
    { 
      id: 'efficiency',
      title: 'الطلبات المعلقة', 
      value: dashboardData?.stats?.pendingOrders || 0, 
      trend: dashboardData?.stats?.pendingOrders && dashboardData.stats.pendingOrders > 10 ? 'حمل مرتفع' : 'مستقر',
      trendUp: false,
      icon: AlertCircle,
      color: 'red'
    }
  ];

  const riderAvailabilityData = [
    { name: 'متاح', value: dashboardData?.stats?.availableDrivers || 0, color: '#10b981' },
    { name: 'مشغول', value: dashboardData?.stats?.busyDrivers || 0, color: '#3b82f6' },
    { name: 'غير متصل', value: dashboardData?.stats?.offlineDrivers || 0, color: '#475569' },
  ];

  // Logic Conflict Alerts - mixing real count with mock patterns for UX
  const conflictAlerts = [
    ...(dashboardData?.stats?.pendingOrders && dashboardData.stats.pendingOrders > 0 ? [{
      id: 'pending-alert',
      title: 'طلبات معلقة تتجاوز الحد الزمني',
      description: `يوجد حالياً ${dashboardData.stats.pendingOrders} طلب/طلبات بحالة "معلق" لم يتم تخصيص مناديب لها.`,
      suggestion: 'توزيع آلي للمناديب القريبين',
      type: 'error'
    }] : []),
    { id: 2, title: 'تأخير في التوصيل المرتقب', description: 'مندوب "عمر خالد" لم يتحرك من موقعه منذ 15 دقيقة مع وجود طلب نشط.', suggestion: 'إرسال تنبيه للمندوب', type: 'warning' },
  ];

  return (
    <div className="space-y-8 font-sans transition-colors duration-300 min-h-screen bg-gray-50 dark:bg-[#0a0a0c] p-4 lg:p-8" dir="rtl">
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-gray-200 dark:border-white/5">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">لوحة تحكم زاجل إكسبريس</h1>
          <p className="text-gray-500 dark:text-slate-500 text-sm font-medium mt-1 uppercase tracking-widest">نظام إدارة العمليات واللوجستيات</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
          <div className="relative flex-1 lg:min-w-[300px]">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
            <input 
              type="text" 
              placeholder="البحث عن طلبات، مناديب، أو عملاء..."
              className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-3 pr-11 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all placeholder:text-gray-400 dark:placeholder:text-slate-600 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-3 bg-white dark:bg-white/5 px-6 py-3 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
            <Clock className="w-4 h-4 text-emerald-500" />
            <div className="text-sm font-bold flex items-center gap-2">
              <span className="text-gray-900 dark:text-white">{format(currentTime, 'pp')}</span>
              <span className="text-gray-400 dark:text-slate-500 border-r border-gray-200 dark:border-white/10 pr-2 mr-2 leading-none">{format(currentTime, 'dd MMMM yyyy', { locale: ar })}</span>
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-8">
        {/* KPI Grid */}
        <div>
          <h2 className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4">مؤشرات الأداء الرئيسية</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {kpiCards.map((card) => (
              <motion.div 
                key={card.id}
                whileHover={{ y: -5, scale: 1.02 }}
                className="bg-white dark:bg-[#15151a] border border-gray-100 dark:border-white/5 p-6 rounded-2xl relative overflow-hidden group shadow-sm dark:shadow-2xl"
              >
                <div className={cn(
                  "absolute top-0 right-0 w-24 h-24 blur-[60px] opacity-10 dark:opacity-20 -mr-12 -mt-12 transition-all duration-500 group-hover:opacity-20 dark:group-hover:opacity-40",
                  card.color === 'emerald' ? "bg-emerald-500" : card.color === 'blue' ? "bg-blue-500" : card.color === 'amber' ? "bg-amber-500" : "bg-red-500"
                )} />
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className={cn(
                    "p-3 rounded-xl",
                    card.color === 'emerald' ? "bg-emerald-500/10 text-emerald-500" : 
                    card.color === 'blue' ? "bg-blue-500/10 text-blue-500" : 
                    card.color === 'amber' ? "bg-amber-500/10 text-amber-500" : 
                    "bg-red-500/10 text-red-500"
                  )}>
                    <card.icon className="w-6 h-6" />
                  </div>
                  <div className={cn(
                    "text-xs font-black flex items-center gap-1 px-2 py-1 rounded-lg",
                    card.trendUp ? "text-emerald-500 bg-emerald-500/10" : "text-amber-500 bg-amber-500/10"
                  )}>
                    {card.trend}
                  </div>
                </div>
                <div className="relative z-10">
                  <p className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">{card.title}</p>
                  <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight leading-none">{card.value}</h3>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Logic Conflict Alerts */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em]">تنبيهات تعارض المنطق (AI)</h2>
            <div className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">جاهز للإصلاح الذاتي</div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {conflictAlerts.map((alert) => (
              <div key={alert.id} className="bg-white dark:bg-[#15151a] border border-gray-100 dark:border-white/5 p-4 rounded-xl flex items-start gap-4 shadow-sm">
                <div className={cn(
                  "p-2 rounded-lg shrink-0",
                  alert.type === 'error' ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
                )}>
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{alert.title}</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-500 mb-2">{alert.description}</p>
                  <button className="text-[10px] font-black bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-lg hover:bg-emerald-500 hover:text-white transition-all">
                    تطبيق الحل المقترح: {alert.suggestion}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Central Grid: Map and Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Live Order Stream */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em]">بث الطلبات المباشر</h2>
              <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
            </div>
            <div className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2 pb-2">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-gray-100 dark:bg-white/5 h-28 rounded-xl animate-pulse" />
                ))
              ) : dashboardData?.recentOrders?.map((order: any) => (
                <div key={order.id} className="bg-white dark:bg-[#15151a] border-r-4 border-emerald-500 p-4 rounded-xl border border-gray-100 dark:border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer group shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-black text-blue-500 dark:text-blue-400">طلب #{order.order_number}</span>
                    <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500">{format(new Date(order.created_at), 'p', { locale: ar })}</span>
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{order.customer?.full_name || 'عميل'}</h4>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 mb-2 truncate">المجموع: {order.grand_total} ج.م</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-emerald-500/10 rounded-full flex items-center justify-center shrink-0">
                        <Truck className="w-3 h-3 text-emerald-500" />
                      </div>
                      <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400">التوصيل: القاهرة</span>
                    </div>
                    <span className={cn(
                      "text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-tighter whitespace-nowrap",
                      order.status === 'Completed' ? "bg-emerald-500/10 text-emerald-500" : 
                      order.status === 'Pending' ? "bg-amber-500/10 text-amber-500" :
                      "bg-blue-500/10 text-blue-500"
                    )}>
                      {order.status === 'Completed' ? 'مكتمل' : 
                       order.status === 'Pending' ? 'معلق' : 'جاري'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Real Geographic Map */}
          <div className="lg:col-span-9 bg-white dark:bg-[#15151a] border border-gray-100 dark:border-white/5 rounded-3xl relative overflow-hidden group shadow-2xl min-h-[500px]">
             <div className="absolute top-6 right-8 z-10 flex items-center gap-3 pointer-events-none">
               <h2 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-[0.2em] bg-white/80 dark:bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 shadow-xl">
                 الخارطة التفاعلية | تتبع المواقع الحقيقي
               </h2>
             </div>

             <div ref={mapRef} className="absolute inset-0 w-full h-full" />

             {/* Map Controls */}
             <div className="absolute bottom-6 right-8 flex flex-col gap-3 z-10">
               <button className="w-12 h-12 bg-white/80 dark:bg-black/60 backdrop-blur-md rounded-xl border border-gray-200 dark:border-white/10 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all text-gray-600 dark:text-slate-400 group shadow-lg">
                 <Navigation className="w-5 h-5 group-hover:scale-110 transition-transform" />
               </button>
             </div>

             {/* Legend */}
             <div className="absolute bottom-6 left-8 bg-white/80 dark:bg-black/60 backdrop-blur-md px-6 py-4 rounded-2xl border border-gray-200 dark:border-white/10 z-10 flex gap-6 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                  <span className="text-[10px] font-black uppercase text-gray-700 dark:text-slate-200 tracking-wider">موقع النشاط</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
                  <span className="text-[10px] font-black uppercase text-gray-700 dark:text-slate-200 tracking-wider">المناديب</span>
                </div>
             </div>
          </div>
        </div>

        {/* Bottom Section: Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-12">
           {/* Order Performance Bar Chart */}
           <div className="lg:col-span-8 bg-white dark:bg-[#15151a] border border-gray-100 dark:border-white/5 p-8 rounded-3xl shadow-sm dark:shadow-2xl">
              <div className="flex items-center justify-between mb-10">
                 <div>
                    <h2 className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">أداء الطلبات الأسبوعي</h2>
                    <p className="text-lg font-black text-gray-900 dark:text-white">توزيع الطلبات حسب الأيام</p>
                 </div>
                 <div className="flex items-center gap-4 bg-gray-50 dark:bg-black/20 p-2 rounded-xl">
                    <div className="flex items-center gap-2 px-3">
                      <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
                      <span className="text-[10px] font-black uppercase text-gray-400 dark:text-slate-500">عدد الطلبات</span>
                    </div>
                 </div>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData?.chartData || []} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis 
                      dataKey="label" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                      dy={15}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(16,185,129,0.05)' }}
                      contentStyle={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', padding: '16px' }}
                      itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                      labelStyle={{ color: '#64748b', marginBottom: '8px', fontSize: '12px', fontWeight: '900' }}
                    />
                    <Bar dataKey="orders" radius={[6, 6, 0, 0]} barSize={30}>
                       {(dashboardData?.chartData || []).map((_entry: any, index: number) => (
                         <Cell key={`cell-${index}`} fill={'#10b981'} fillOpacity={0.8} />
                       ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
           </div>

           {/* Rider Availability Donut Chart */}
           <div className="lg:col-span-4 bg-white dark:bg-[#15151a] border border-gray-100 dark:border-white/5 p-8 rounded-3xl shadow-sm dark:shadow-2xl flex flex-col">
              <h2 className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">توفر المناديب</h2>
              <p className="text-lg font-black text-gray-900 dark:text-white mb-10">الحالة اللحظية للأسطول</p>
              <div className="flex-1 min-h-[250px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie
                       data={riderAvailabilityData}
                       cx="50%"
                       cy="50%"
                       innerRadius={70}
                       outerRadius={95}
                       paddingAngle={10}
                       dataKey="value"
                       stroke="none"
                     >
                       {riderAvailabilityData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.color} />
                       ))}
                     </Pie>
                     <Tooltip 
                       contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                     />
                   </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                   <span className="text-4xl font-black text-gray-900 dark:text-white leading-none tracking-tighter">{dashboardData?.stats?.availableDrivers || 0}</span>
                   <span className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.2em] mt-2">متاح حالياً</span>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 mt-8 bg-gray-50 dark:bg-black/20 p-6 rounded-2xl border border-gray-100 dark:border-white/5">
                 {riderAvailabilityData.map((item) => (
                   <div key={item.name} className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                       <span className="text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-wider">{item.name}</span>
                     </div>
                     <span className="text-sm font-black text-gray-900 dark:text-white">{item.value}</span>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </section>
    </div>
  );
}

