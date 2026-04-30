import fs from 'fs';

let content = fs.readFileSync('src/pages/orders/OrdersList.tsx', 'utf8');

// The file is corrupted near line 920 down to 1130. We need to cut out the corrupted block and replace it.

const startMarker = `            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">`;
const endMarker = `      {/* Order Details Panel */}`;

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.log("MARKERS NOT FOUND");
  process.exit(1);
}

const replacement = `            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-500 font-bold">
                  عرض <span className="text-emerald-600">{page * pageSize + 1}</span> إلى <span className="text-emerald-600">{Math.min((page + 1) * pageSize, data.count)}</span> من أصل <span className="text-emerald-600">{data.count}</span> طلب
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-2xl shadow-sm -space-x-px gap-2" aria-label="Pagination">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="relative inline-flex items-center px-4 py-2 rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    السابق
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setPage(p => p + 1)}
                    disabled={(page + 1) * pageSize >= data.count}
                    className="relative inline-flex items-center px-4 py-2 rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    التالي
                  </motion.button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Assign Driver Modal */}
      <AssignDriverModal 
        isOpen={!!assigningDriverOrderId}
        onClose={() => setAssigningDriverOrderId(null)}
        onAssign={(driverId) => {
          if (assigningDriverOrderId) {
            assignDriverMutation.mutate({ orderId: assigningDriverOrderId, driverId });
          }
        }}
        isAssigning={assignDriverMutation.isPending}
        excludeDriverIds={(() => {
          const order = data?.orders.find(o => o.id === assigningDriverOrderId);
          return order?.delivery_team?.map((dt: any) => dt.driver_id) || [];
        })()}
      />

      {/* Info Modal */}
      {infoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                  {infoModal.type === 'customer' ? 'بيانات العميل' : 
                   infoModal.type === 'vendor' ? 'بيانات المتجر' : 
                   'بيانات المندوب'}
                </h3>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setInfoModal(null)} className="p-2 hover:bg-gray-100 rounded-2xl transition-colors cursor-pointer">
                  <X className="w-6 h-6 text-gray-400" />
                </motion.button>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-3xl border border-gray-100">
                  <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
                    {infoModal.type === 'customer' ? <User className="w-8 h-8 text-emerald-600" /> : 
                     infoModal.type === 'vendor' ? <Store className="w-8 h-8 text-emerald-600" /> : 
                     <Motorbike className="w-8 h-8 text-emerald-600" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">الاسم</div>
                    <div className="text-lg font-black text-gray-900">
                      {infoModal.type === 'customer' ? infoModal.data.full_name : 
                       infoModal.type === 'vendor' ? infoModal.data.brand_name : 
                       infoModal.data.full_name}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-3xl border border-gray-100">
                  <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                    <Phone className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">رقم الهاتف</div>
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-black text-gray-900" dir="ltr">
                        {infoModal.type === 'customer' ? infoModal.data.primary_phone : 
                         infoModal.type === 'vendor' ? infoModal.data.profiles?.primary_phone : 
                         infoModal.data.primary_phone}
                      </div>
                      <a 
                        href={\`tel:\${infoModal.type === 'customer' ? infoModal.data.primary_phone : 
                               infoModal.type === 'vendor' ? infoModal.data.profiles?.primary_phone : 
                               infoModal.data.primary_phone}\`}
                        className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 group/call"
                      >
                        <Phone className="w-5 h-5 group-hover/call:rotate-12 transition-transform" />
                      </a>
                    </div>
                  </div>
                </div>

                {(infoModal.type === 'customer' || infoModal.type === 'vendor') && (
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-3xl border border-gray-100">
                    <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                      <Filter className="w-6 h-6 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">العنوان / العلامة المميزة</div>
                      <div className="text-sm font-bold text-gray-900 leading-relaxed">
                        {infoModal.type === 'customer' ? (
                          infoModal.data.address ? \`\${infoModal.data.address.city}، \${infoModal.data.address.district}، \${infoModal.data.address.street_name}\` : 'غير متوفر'
                        ) : (
                          infoModal.data.landmark || 'غير متوفر'
                        )}
                      </div>
                      {(infoModal.type === 'customer' ? infoModal.data.address?.location_gps : infoModal.data.location_gps) && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            const zoneId = infoModal.type === 'customer' ? infoModal.data.address?.zone_id : infoModal.data.zone_id;
                            const id = infoModal.type === 'customer' ? infoModal.data.masterOrderId : (infoModal.data.user_id || infoModal.data.id);
                            const type = infoModal.type === 'customer' ? 'order' : 'vendor';
                            
                            navigate(\`/map?type=\${type}&id=\${id}\${zoneId ? \`&zone=\${zoneId}\` : ''}\`);
                            setInfoModal(null);
                          }}
                          className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-200 transition-colors text-xs font-bold cursor-pointer"
                        >
                          <MapPin className="w-4 h-4" />
                          تتبع الموقع داخلياً
                        </motion.button>
                      )}
                    </div>
                  </div>
                )}
                
                {infoModal.type === 'driver' && (
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-3xl border border-gray-100">
                    <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">الموقع المباشر</div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          const zoneId = infoModal.data.zone_id;
                          const id = infoModal.data.user_id || infoModal.data.id;
                          navigate(\`/map?type=driver&id=\${id}\${zoneId ? \`&zone=\${zoneId}\` : ''}\`);
                          setInfoModal(null);
                        }}
                        className="mt-1 inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-200 transition-colors text-xs font-bold cursor-pointer"
                      >
                        <MapPin className="w-4 h-4" />
                        تتبع السائق داخلياً
                      </motion.button>
                    </div>
                  </div>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setInfoModal(null)}
                className="w-full mt-8 py-4 bg-gray-900 text-white rounded-2xl font-black tracking-widest hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 cursor-pointer"
              >
                إغلاق
              </motion.button>
            </div>
          </div>
        </div>
      )}
      
`;

const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync('src/pages/orders/OrdersList.tsx', newContent);
console.log("FIXED");
