import { useRef, useEffect, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import MultiPolygon from 'ol/geom/MultiPolygon';
import LineString from 'ol/geom/LineString';
import { fromLonLat, toLonLat } from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { Style, Circle, Fill, Stroke, Text } from 'ol/style';
import Overlay from 'ol/Overlay';
import { defaults as defaultControls } from 'ol/control';
import 'ol/ol.css';
import { Store, User, Bike, Phone, Activity } from 'lucide-react';

interface Marker {
  id: string;
  lat: number;
  lng: number;
  type: 'driver' | 'order' | 'vendor';
  title?: string;
  orders?: Set<number>;
  [key: string]: any;
}

interface OpenLayerMapProps {
  markers: Marker[];
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  zones?: any[];
  autoFit?: boolean;
  trackingId?: string | null;
}

export default function OpenLayerMap({ markers, center = [31.2357, 30.0444], zoom = 12, zones = [], autoFit = false, trackingId }: OpenLayerMapProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const popupElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource | null>(null);
  const overlayRef = useRef<Overlay | null>(null);

  const [selectedFeature, setSelectedFeature] = useState<Marker | null>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const lastPropsRef = useRef({ center, zoom, autoFit });

  // Update map size when container is resized
  useEffect(() => {
    if (!mapRef.current || !mapElement.current) return;
    
    const map = mapRef.current;
    const observer = new ResizeObserver(() => {
      map.updateSize();
    });
    
    observer.observe(mapElement.current);
    
    // Initial size update after a short delay to account for animations
    const timer = setTimeout(() => {
      map.updateSize();
    }, 300);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);

  // Detect manual movement to disable following
  useEffect(() => {
    if (!mapRef.current) return;
    
    const map = mapRef.current;
    
    // Check moving state frequently or on move events
    const handleMoveEnd = () => {
      const view = map.getView();
      // If the view is interacting (user is dragging/zooming) 
      // or was just interacting, we stop following.
      if (view.getInteracting()) {
        setIsFollowing(false);
      }
    };

    // Also explicitly catch wheel and pointer events to be safe
    const handleManualControl = () => {
      setIsFollowing(false);
    };

    map.on('moveend', handleMoveEnd);
    map.getViewport().addEventListener('wheel', handleManualControl, { passive: true });
    map.getViewport().addEventListener('pointerdown', handleManualControl, { passive: true });
    
    return () => {
      map.un('moveend', handleMoveEnd);
      map.getViewport()?.removeEventListener('wheel', handleManualControl);
      map.getViewport()?.removeEventListener('pointerdown', handleManualControl);
    };
  }, []);

  // When props change intentionally (user chose a new filter), re-enable follow and center
  const lastTrackingIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // If trackingId explicitly changed, user chose a new target
    const trackingChanged = trackingId !== lastTrackingIdRef.current;
    
    // Or if zoom or autoFit explicitly changed
    const controlPropsChanged = 
      lastPropsRef.current.zoom !== zoom ||
      lastPropsRef.current.autoFit !== autoFit;

    if (trackingChanged || controlPropsChanged) {
      setIsFollowing(true);
      lastPropsRef.current = { center, zoom, autoFit };
      lastTrackingIdRef.current = trackingId;
    } else {
      // Just update center ref without triggering follow
      lastPropsRef.current.center = center;
    }
  }, [trackingId, zoom, autoFit, center]);

  useEffect(() => {
    if (!mapElement.current || !popupElement.current) return;

    const vectorSource = new VectorSource();
    vectorSourceRef.current = vectorSource;

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      updateWhileAnimating: true,
      updateWhileInteracting: true,
    });

    const overlay = new Overlay({
      element: popupElement.current,
      positioning: 'bottom-center',
      stopEvent: true,
      offset: [0, -15],
    });
    overlayRef.current = overlay;

    const isMobile = window.innerWidth < 768;

    const initialMap = new Map({
      target: mapElement.current,
      controls: defaultControls({ 
        attribution: true,
        rotate: false,
        zoom: !isMobile
      }),
      layers: [
        new TileLayer({
          source: new OSM({
            attributions: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
            crossOrigin: 'anonymous'
          }),
        }),
        vectorLayer,
      ],
      view: new View({
        center: fromLonLat(center),
        zoom: zoom,
      }),
    });

    initialMap.addOverlay(overlay);

    initialMap.on('click', (evt) => {
      const feature = initialMap.forEachFeatureAtPixel(evt.pixel, (f) => f);
      if (feature && feature.get('markerData')) {
        const marker = feature.get('markerData');
        setSelectedFeature(marker);
        overlay.setPosition(evt.coordinate);
        
        // Pan to feature smoothly
        initialMap.getView().animate({ center: evt.coordinate, duration: 500 });
      } else {
        setSelectedFeature(null);
        overlay.setPosition(undefined);
      }
    });

    initialMap.on('pointermove', function (e) {
      if (e.dragging) return;
      const pixel = initialMap.getEventPixel(e.originalEvent);
      const hit = initialMap.hasFeatureAtPixel(pixel);
      initialMap.getTargetElement().style.cursor = hit ? 'pointer' : '';
    });

    mapRef.current = initialMap;

    return () => {
      initialMap.setTarget(undefined);
      initialMap.dispose();
    };
  }, []);

  const lastZoomProp = useRef(zoom);

  // Update center smoothly when tracking
  useEffect(() => {
    if (!mapRef.current || autoFit || !isFollowing) return;

    const view = mapRef.current.getView();
    const currentCenter = toLonLat(view.getCenter() || [0, 0]);
    const targetCenter = center;

    // Check if the center actually moved significantly to avoid tiny jitters
    const dist = Math.sqrt(Math.pow(currentCenter[0] - targetCenter[0], 2) + Math.pow(currentCenter[1] - targetCenter[1], 2));
    
    // Check if zoom prop changed explicitly from the last time we saw it
    const zoomChanged = zoom !== lastZoomProp.current;
    lastZoomProp.current = zoom;

    if (dist > 0.00001 || zoomChanged) {
      view.animate({ 
        center: fromLonLat(targetCenter), 
        zoom: zoomChanged ? zoom : view.getZoom(), // Use current map zoom unless prop changed
        duration: 800 
      });
    }
  }, [center, zoom, autoFit, isFollowing]);

  useEffect(() => {
    if (!vectorSourceRef.current || !mapRef.current) return;
    
    const isMobile = window.innerWidth < 768;
    vectorSourceRef.current.clear();
    
    const zoneFeatures: Feature[] = [];
    zones.forEach((zone) => {
      const boundary = zone.boundary;
      if (boundary && boundary.coordinates) {
        let geom;
        if (boundary.type === 'Polygon') {
          const transformedCoords = boundary.coordinates.map((ring: any) =>
            ring.map((coord: any) => fromLonLat(coord))
          );
          geom = new Polygon(transformedCoords);
        } else if (boundary.type === 'MultiPolygon') {
          const transformedCoords = boundary.coordinates.map((poly: any) =>
            poly.map((ring: any) =>
              ring.map((coord: any) => fromLonLat(coord))
            )
          );
          geom = new MultiPolygon(transformedCoords);
        }

        if (geom) {
          const feature = new Feature({ geometry: geom });
          feature.setStyle(
            new Style({
              stroke: new Stroke({
                color: '#dc2626', // red-600
                width: 2,
                lineDash: [8, 8],
              }),
              fill: new Fill({
                color: 'transparent',
              })
            })
          );
          zoneFeatures.push(feature);
        }
      }
    });

    // Draw relation lines between related markers (same order) if autoFit (filtered view)
    const lineFeatures: Feature[] = [];
    if (autoFit && markers.length > 1) {
      // Find all unique orders currently in markers
      const allOrders = new Set<number>();
      markers.forEach(m => {
        if (m.orders) {
          m.orders.forEach(o => allOrders.add(o));
        } else if (m.type === 'order' && m.title) {
          const match = m.title.match(/#(\d+)/);
          if (match) allOrders.add(parseInt(match[1]));
        }
      });

      allOrders.forEach(orderId => {
        // Find markers for this order
        const related = markers.filter(m => {
          if (m.orders && m.orders.has(orderId)) return true;
          if (m.type === 'order' && m.title?.includes(`#${orderId}`)) return true;
          return false;
        });

        if (related.length > 1) {
          // Sort to draw a logical path: Vendor -> Driver -> Customer
          const vendor = related.find(m => m.type === 'vendor');
          const driver = related.find(m => m.type === 'driver');
          const order = related.find(m => m.type === 'order');

          const pathCoords: [number, number][] = [];
          if (vendor) pathCoords.push([vendor.lng, vendor.lat]);
          if (driver) pathCoords.push([driver.lng, driver.lat]);
          if (order) pathCoords.push([order.lng, order.lat]);
          
          if (pathCoords.length > 1) {
            const geom = new LineString(pathCoords.map(c => fromLonLat(c)));
            const lineFeature = new Feature({ geometry: geom });
            lineFeature.setStyle(new Style({
              stroke: new Stroke({
                color: '#6366f1', // indigo
                width: 3,
                lineDash: [6, 6]
              })
            }));
            lineFeatures.push(lineFeature);
          }
        }
      });
    }

    const mFeatures = markers.map((marker) => {
      const feature = new Feature({
        geometry: new Point(fromLonLat([marker.lng, marker.lat])),
      });
      feature.set('markerData', marker);

      let color = '#6b7280';
      if (marker.type === 'driver') color = '#3b82f6'; // blue
      if (marker.type === 'order') color = '#ef4444'; // red
      if (marker.type === 'vendor') color = '#10b981'; // green

      const style = new Style({
        image: new Circle({
          radius: 8,
          fill: new Fill({ color }),
          stroke: new Stroke({ color: '#ffffff', width: 2 })
        }),
        text: new Text({
          text: marker.title?.substring(0, 15) + (marker.title && marker.title.length > 15 ? '...' : '') || '',
          offsetY: -15,
          font: 'bold 12px Inter, sans-serif',
          fill: new Fill({ color: '#1f2937' }),
          stroke: new Stroke({ color: '#ffffff', width: 3 }),
          textAlign: 'center',
          textBaseline: 'bottom'
        })
      });

      feature.setStyle(style);
      return feature;
    });

    vectorSourceRef.current.addFeatures([...zoneFeatures, ...lineFeatures, ...mFeatures]);
    
    // Fit extent if autoFit is requested and there are features
    if (autoFit && isFollowing) {
      setTimeout(() => {
         const extent = vectorSourceRef.current?.getExtent();
         if (extent && !extent.every(v => v === Infinity || v === -Infinity) && mapRef.current) {
            mapRef.current.getView().fit(extent, {
              padding: isMobile ? [40, 40, 40, 40] : [80, 80, 80, 80],
              duration: 1000,
              maxZoom: isMobile ? 15 : 16
            });
         }
      }, 100);
    }
  }, [markers, zones, autoFit, isFollowing]);

  return (
    <div className="w-full h-full min-h-[400px] relative border border-gray-200 rounded-2xl overflow-hidden shadow-sm bg-slate-50">
      <div ref={mapElement} className="absolute inset-0 z-0 h-full w-full" />
      
      {/* Follow Toggle Button */}
      {!isFollowing && (
        <button 
          onClick={() => setIsFollowing(true)}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full shadow-2xl z-20 flex items-center gap-2 font-bold transition-colors cursor-pointer"
        >
          <Activity className="w-4 h-4" />
          تفعيل المتابعة التلقائية
        </button>
      )}



      {/* Hidden container for the overlay popup */}
      <div className="hidden">
        <div 
          ref={popupElement} 
          className="bg-white rounded-xl shadow-xl shadow-black/10 border border-gray-100 p-4 min-w-[240px]"
          dir="rtl"
        >
          {selectedFeature && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-indigo-600 mb-1 border-b border-gray-50 pb-2">
                {selectedFeature.type === 'driver' && <Bike className="w-5 h-5" />}
                {selectedFeature.type === 'vendor' && <Store className="w-5 h-5" />}
                {selectedFeature.type === 'order' && <User className="w-5 h-5" />}
                <span className="font-bold">
                  {selectedFeature.type === 'driver' ? 'مسار السائق' : selectedFeature.type === 'vendor' ? 'بيانات المتجر' : 'بيانات الطلب'}
                </span>
              </div>
              <div className="space-y-2">
                <p className="text-gray-900 font-bold text-sm leading-tight">{selectedFeature.title}</p>
                
                {selectedFeature.phone && (
                  <div className="flex flex-col gap-2 pt-1">
                    <div className="text-xs text-gray-600 flex items-center gap-1.5 font-medium">
                      <span className="text-gray-400">📞</span>
                      <span dir="ltr">{selectedFeature.phone}</span>
                    </div>
                    <a 
                      href={`tel:${selectedFeature.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-bold transition-colors w-full shadow-sm"
                    >
                      <Phone className="w-4 h-4" />
                      اتصال مباشر
                    </a>
                  </div>
                )}
                
                {selectedFeature.address && (
                  <div className="text-xs text-gray-700 bg-gray-50 p-2 rounded-lg flex items-start gap-1.5 border border-gray-100">
                    <span className="text-indigo-400 mt-0.5">📍</span>
                    <div className="flex flex-col">
                      <span className="text-[11px] text-gray-400 font-bold mb-0.5">العنوان:</span>
                      <span className="leading-tight">{selectedFeature.address}</span>
                    </div>
                  </div>
                )}
                
                {selectedFeature.info && (
                  <div className="text-xs text-blue-600 bg-blue-50 p-1.5 rounded-lg flex items-start gap-1.5">
                    <span className="text-blue-400 mt-0.5">ℹ️</span>
                    <span className="leading-tight">{selectedFeature.info}</span>
                  </div>
                )}

                {selectedFeature.orders && selectedFeature.orders.size > 0 && (
                 <div className="text-xs bg-gray-50 border border-gray-100 p-2 rounded-lg mt-1 font-medium text-gray-700">
                    <span className="text-gray-400 block mb-1">الطلبات المرتبطة:</span>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(selectedFeature.orders).map(orderNum => (
                        <span key={orderNum} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                          #{orderNum}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

