const fs = require('fs');

const content = fs.readFileSync('/app/applet/src/pages/orders/OrdersList.tsx', 'utf-8');

const startToken = '      {/* Cards Grid */}';
const endToken = '      {/* Pagination */}';

const startIndex = content.indexOf(startToken);
const endIndex = content.indexOf(endToken);

if (startIndex === -1 || endIndex === -1) {
  console.error("Tokens not found.");
  process.exit(1);
}

const replacement = `      {/* Cards Grid */}
      <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5 transition-opacity duration-300", isFetching && !isLoading ? "opacity-60" : "")}>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={\`orders-skeleton-\${index}\`} className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 animate-pulse flex flex-col gap-4">
              <div className="flex justify-between items-center"><div className="h-6 bg-gray-200 dark:bg-slate-700 rounded-xl w-24"></div><div className="h-6 bg-gray-200 dark:bg-slate-700 rounded-full w-20"></div></div>
              <div className="h-10 bg-gray-200 dark:bg-slate-700 rounded-2xl w-full"></div>
              <div className="h-16 bg-gray-200 dark:bg-slate-700 rounded-2xl w-full"></div>
            </div>
          ))
        ) : sortedOrders.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-slate-800 p-12 text-center text-gray-500 dark:text-gray-400 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-full">
                <Search className="w-8 h-8 text-gray-300 dark:text-gray-500" />
              </div>
              <span className="font-bold text-gray-400 dark:text-gray-400 text-lg">لا توجد طلبات تطابق معايير البحث</span>
            </div>
          </div>
        ) : (
          sortedOrders.map((order, idx) => {
            const delay = getDelayStatusForOrder(order);
            const isDelayed = delay.isDelayed;
            
            return (
              <div 
                key={order.id || \`order-\${idx}\`} 
                className={cn(
                  "bg-white dark:bg-slate-800 rounded-3xl border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden relative group/card",
                  isDelayed ? "border-red-200 dark:border-red-900/50" : "border-gray-100 dark:border-slate-700"
                )}
              >
                
                {/* Header Section */}
                <div className={cn(
                  "p-3.5 border-b flex items-start justify-between backdrop-blur-md",
                  isDelayed 
                    ? "bg-gradient-to-r from-red-50/80 to-white dark:from-red-900/20 dark:to-slate-800 border-red-50 dark:border-red-900/30" 
                    : "bg-gradient-to-r from-gray-50/80 to-white dark:from-slate-800/80 dark:to-slate-800 border-gray-50 dark:border-slate-700/50"
                )}>
                  <div className="flex items-center gap-3">
                    {visibleColumns.includes('order_number') && (
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-black text-gray-900 dark:text-white bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 px-3 py-1.5 rounded-xl shadow-sm">#{order.order_number}</span>
                        {order.notes && (
                          <div className="group/note relative">
                            <MessageSquare className="w-4 h-4 text-emerald-500 dark:text-emerald-400 cursor-help drop-shadow-sm" />
                            <div className="hidden group-hover/note:block absolute z-20 w-64 p-4 bg-gray-900 dark:bg-gray-950 text-white text-xs rounded-2xl shadow-2xl top-full right-0 mt-2 leading-relaxed border border-gray-800">
                              <div className="font-black mb-1 text-emerald-400 uppercase tracking-widest">ملاحظات العميل:</div>
                              {order.notes}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {visibleColumns.includes('status') && (
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedHistoryOrder(order);
                        }}
                        className={cn(
                          "px-3 py-1 inline-flex items-center gap-1.5 text-[10px] font-black rounded-xl border uppercase tracking-[0.1em] hover:opacity-80 transition-all cursor-pointer shadow-sm relative overflow-hidden",
                          statusColors[order.status as OrderStatus],
                          "dark:bg-opacity-20 dark:shadow-none"
                        )}
                      >
                        <span className="relative z-10">{statusNames[order.status as OrderStatus]}</span>
                      </motion.button>
                    )}
                    {visibleColumns.includes('date') && (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold flex items-center gap-1 opacity-80">
                        <Clock className="w-3 h-3" />
                        {format(new Date(order.created_at), 'PPpp', { locale: ar })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Body Section */}
                <div className="p-3.5 flex-1 flex flex-col gap-3.5">
                  {visibleColumns.includes('customer') && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest pl-1">العميل</span>
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setInfoModal({ 
                          type: 'customer', 
                          data: { ...order.customer, address: order.address, masterOrderId: order.id } 
                        })}
                        className="flex items-center text-right group/info bg-gray-50 hover:bg-emerald-50 dark:bg-slate-700/30 dark:hover:bg-slate-700 p-2 rounded-2xl transition-all cursor-pointer border border-transparent hover:border-emerald-100 dark:hover:border-slate-600"
                      >
                        <div className="h-8 w-8 rounded-full bg-white dark:bg-slate-600 flex items-center justify-center border border-gray-200 dark:border-slate-500 group-hover/info:border-emerald-200 dark:group-hover/info:border-emerald-500/50 shadow-sm overflow-hidden shrink-0 transition-colors">
                          {order.customer?.avatar_url ? (
                            <img 
                              src={order.customer.avatar_url} 
                              alt="" 
                              className="h-full w-full object-cover rounded-full"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          )}
                        </div>
                        <div className="mr-2.5 overflow-hidden flex-1">
                          <div className="text-xs font-bold text-gray-800 dark:text-gray-200 group-hover/info:text-emerald-700 dark:group-hover/info:text-emerald-400 truncate">{order.customer?.full_name || 'غير معروف'}</div>
                        </div>
                      </motion.button>
                    </div>
                  )}

                  {visibleColumns.includes('vendors') && (
                    <div className="flex flex-col gap-1.5 border-t border-gray-100/60 dark:border-slate-700/60 pt-3">
                      <span className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest pl-1">المتاجر</span>
                      {order.sub_orders?.length > 1 ? (
                        <div className="relative">
                          <motion.button
                            onClick={() => setOpenVendorDropdownId(openVendorDropdownId === order.id ? null : order.id)}
                            className="flex items-center justify-between w-full text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2.5 rounded-xl border border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all cursor-pointer shadow-sm"
                          >
                            <div className="flex items-center gap-2">
                              <Store className="w-3.5 h-3.5" />
                              <span>{order.sub_orders.length} متاجر</span>
                            </div>
                            <ChevronDown className={cn("w-4 h-4 transition-transform", openVendorDropdownId === order.id && "rotate-180")} />
                          </motion.button>
                          
                          <AnimatePresence>
                            {openVendorDropdownId === order.id && (
                              <motion.div
                                initial={{ opacity: 0, y: -5, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: 'auto' }}
                                exit={{ opacity: 0, y: -5, height: 0 }}
                                className="overflow-hidden bg-white dark:bg-slate-800 rounded-b-xl border-x border-b border-emerald-100 dark:border-emerald-800/50 flex flex-col shadow-lg absolute w-full z-10"
                              >
                                {order.sub_orders.map((so: any, idx: number) => (
                                  <motion.button 
                                    key={so.id || \`so-\${idx}\`} 
                                    onClick={() => { setInfoModal({ type: 'vendor', data: { ...so.vendor, masterOrderId: order.id } }); setOpenVendorDropdownId(null); }}
                                    className="flex items-center justify-between text-[11px] font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 px-3 py-2.5 transition-colors w-full text-right cursor-pointer border-t border-gray-50 dark:border-slate-700/50"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="w-5 h-5 rounded bg-white dark:bg-slate-700 flex items-center justify-center shrink-0 border border-gray-100 dark:border-slate-600 overflow-hidden shadow-sm">
                                        {so.vendor?.profile?.avatar_url ? (
                                          <img src={so.vendor.profile.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        ) : (
                                          <Store className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                                        )}
                                      </div>
                                      <span className="truncate max-w-[120px]">{so.vendor?.brand_name || 'غير معروف'}</span>
                                    </div>
                                    <span className="text-[9px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-lg border border-emerald-100/50 dark:border-emerald-800/50">
                                      {so.order_items?.length || 0} منتج
                                    </span>
                                  </motion.button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {order.sub_orders?.map((so: any, idx: number) => (
                            <motion.button 
                              key={so.id || \`so-\${idx}\`} 
                              onClick={() => setInfoModal({ type: 'vendor', data: { ...so.vendor, masterOrderId: order.id } })}
                              className="flex items-center gap-2 text-[11px] font-bold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-slate-700/30 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-slate-700/60 w-full hover:bg-emerald-50 dark:hover:bg-slate-700 hover:border-emerald-200 dark:hover:border-slate-600 transition-all group/vinfo cursor-pointer shadow-sm"
                            >
                              <div className="w-6 h-6 rounded bg-white dark:bg-slate-600 flex items-center justify-center shrink-0 border border-gray-200 dark:border-slate-500 overflow-hidden shadow-sm">
                                {so.vendor?.profile?.avatar_url ? (
                                  <img src={so.vendor.profile.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <Store className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 group-hover/vinfo:scale-110 transition-transform" />
                                )}
                              </div>
                              <span className="group-hover/vinfo:text-emerald-700 dark:group-hover/vinfo:text-emerald-400 flex-1 text-right truncate">{so.vendor?.brand_name || 'متجر غير معروف'}</span>
                              <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-lg font-bold border border-emerald-200/50 dark:border-emerald-800/50 shrink-0">
                                {so.order_items?.length || 0} منتج
                              </span>
                            </motion.button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {visibleColumns.includes('driver') && (
                    <div className="flex flex-col gap-1.5 border-t border-gray-100/60 dark:border-slate-700/60 pt-3">
                      <span className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest pl-1">المندوب</span>
                      {order.delivery_team && order.delivery_team.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {order.delivery_team.map((teamMember: any) => {
                            const activeMasterOrderIds = new Set(
                              teamMember.driver?.active_orders
                                ?.filter((ao: any) => ao.master_order && !['Completed', 'Cancelled'].includes(ao.master_order.status))
                                .map((ao: any) => ao.master_order.id)
                            );
                            const activeCount = activeMasterOrderIds.size;
                            return (
                              <div key={teamMember.id} className="flex items-center justify-between p-2 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30">
                                <motion.button 
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => setInfoModal({ 
                                    type: 'driver', 
                                    data: { 
                                      ...teamMember.driver?.user, 
                                      location_gps: teamMember.driver?.driver_location?.location,
                                      zone_id: teamMember.driver?.zone_id 
                                    } 
                                  })}
                                  className="flex items-center text-right group/dinfo cursor-pointer transition-all flex-1 overflow-hidden min-w-0"
                                >
                                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center overflow-hidden shrink-0 border border-indigo-200 dark:border-indigo-800 shadow-sm transition-colors">
                                    {teamMember.driver?.user?.avatar_url ? (
                                      <img 
                                        src={teamMember.driver.user.avatar_url} 
                                        alt="" 
                                        className="h-full w-full object-cover rounded-full"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <Motorbike className="w-4 h-4 text-indigo-600 dark:text-indigo-400 group-hover/dinfo:scale-110 transition-transform" />
                                    )}
                                  </div>
                                  <div className="mr-2 flex flex-row items-center gap-2 overflow-hidden w-full">
                                    <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 group-hover/dinfo:text-indigo-700 dark:group-hover/dinfo:text-indigo-400 truncate">{teamMember.driver?.user?.full_name}</span>
                                    {activeCount > 0 && (
                                      <span className="text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded-md font-black shrink-0 shadow-sm tracking-wider">
                                        {activeCount} طلب
                                      </span>
                                    )}
                                  </div>
                                </motion.button>
                                <div className="flex items-center gap-1.5 shrink-0 pr-1">
                                  <motion.button 
                                    whileHover={{ scale: 1.1 }}
                                    onClick={(e) => { e.stopPropagation(); setAssigningDriverOrderId(order.id); }}
                                    className="p-1.5 bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 border border-gray-100 dark:border-slate-600 rounded-lg hover:border-indigo-200 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-slate-600 cursor-pointer shadow-sm transition-colors"
                                  >
                                    <UserPlus className="w-3 h-3" />
                                  </motion.button>
                                  <motion.button 
                                    whileHover={{ scale: 1.1 }}
                                    onClick={(e) => { e.stopPropagation(); removeDriverMutation.mutate({ teamId: teamMember.id, driverId: teamMember.driver_id }); }}
                                    className="p-1.5 bg-white dark:bg-slate-700 text-red-500 dark:text-red-400 border border-gray-100 dark:border-slate-600 rounded-lg hover:border-red-200 dark:hover:border-red-900/50 hover:bg-red-50 dark:hover:bg-slate-600 cursor-pointer shadow-sm transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </motion.button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-0.5">
                          <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={(e) => { e.stopPropagation(); autoAssignDriverMutation.mutate(order.id); }}
                            disabled={autoAssignDriverMutation.isPending}
                            className="flex items-center justify-center gap-1.5 flex-1 py-2 bg-zap-gradient text-white rounded-xl text-[10px] font-black shadow-md shadow-amber-500/20 hover:shadow-amber-500/40 hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>تلقائي</span>
                          </motion.button>
                          <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={(e) => { e.stopPropagation(); setAssigningDriverOrderId(order.id); }}
                            className="flex items-center justify-center gap-1.5 flex-1 py-2 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-600 rounded-xl text-[10px] font-black shadow-sm hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>يدوي</span>
                          </motion.button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-gray-100/60 dark:border-slate-700/60 pt-3 mt-1">
                    {visibleColumns.includes('total') && (
                      <div className="flex flex-col gap-0.5 flex-1 min-w-[30%]">
                        <span className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest leading-tight">الإجمالي</span>
                        <div className="flex items-baseline flex-wrap gap-1.5">
                          <span className="text-sm font-black text-gray-900 dark:text-white leading-tight">{order.grand_total} <span className="text-[10px] text-gray-500 font-bold dark:text-gray-400">ج.م</span></span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded-md font-bold text-[8px] uppercase tracking-wider border shadow-sm",
                            paymentMethodStyles[order.payment_method] || 'bg-gray-50 text-gray-600 border-gray-100 dark:bg-slate-700 dark:text-gray-300 dark:border-slate-600'
                          )}>
                            {order.payment_method || 'نقداً'}
                          </span>
                        </div>
                      </div>
                    )}
                    {visibleColumns.includes('delivery_fee') && (
                      <div className="flex flex-col gap-0.5 flex-1 min-w-[25%]">
                        <span className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest leading-tight">التوصيل</span>
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 leading-tight">{order.delivery_fee?.toFixed(2) || '0.00'}</span>
                      </div>
                    )}
                    {visibleColumns.includes('total_distance') && (
                      <div className="flex flex-col gap-0.5 flex-1 min-w-[25%]">
                        <span className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest leading-tight">المسافة</span>
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 leading-tight flex items-center gap-0.5">
                           {order.total_distance ? order.total_distance.toFixed(1) : '0.0'} <MapPin className="w-3 h-3 text-gray-400" />
                        </span>
                      </div>
                    )}
                  </div>

                  {visibleColumns.includes('time_tracking') && (
                    <div className="flex flex-row flex-wrap items-center gap-2 border-t border-gray-100/60 dark:border-slate-700/60 pt-3">
                      {order.status !== 'Pending' && (
                        <div className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-xl border font-black text-[10px] w-fit tracking-wider shadow-sm transition-colors",
                          delay.isDelayed && delay.type === 'prep' 
                            ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800 animate-pulse" 
                            : "bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-slate-600"
                        )}>
                          <Clock className="w-3 h-3" />
                          <span>تحضير: {delay.prepElapsed} د</span>
                          {delay.isDelayed && delay.type === 'prep' && <AlertCircle className="w-3 h-3" />}
                        </div>
                      )}
                      {['OnTheWay', 'Completed', 'Cancelled', 'Rejected'].includes(order.status) && (
                        <div className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-xl border font-black text-[10px] w-fit tracking-wider shadow-sm transition-colors",
                          delay.isDelayed && delay.type === 'delivery' 
                            ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800 animate-pulse" 
                            : "bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-slate-600"
                        )}>
                          <Motorbike className="w-3 h-3" />
                          <span>توصيل: {delay.deliveryElapsed} د</span>
                          {delay.isDelayed && delay.type === 'delivery' && <AlertCircle className="w-3 h-3" />}
                        </div>
                      )}
                      {order.status === 'Pending' && (
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold italic tracking-widest pl-1">في انتظار القبول...</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                {visibleColumns.includes('actions') && (
                  <div className="p-3 bg-gray-50/80 dark:bg-slate-800/80 backdrop-blur-md flex items-center justify-end gap-2 mt-auto border-t border-gray-100 dark:border-slate-700/50 group-hover/card:bg-gray-100/50 dark:group-hover/card:bg-slate-700/30 transition-colors">
                    {order.status === 'Pending' && (
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickAccept(order.id);
                        }}
                        className="text-white bg-amber-500 hover:bg-amber-600 shadow-md shadow-amber-500/20 hover:shadow-amber-500/40 px-3 py-2 rounded-xl font-black text-[11px] transition-all flex items-center gap-1.5 cursor-pointer flex-1 justify-center"
                      >
                        <Store className="w-3.5 h-3.5" />
                        <span>قبول</span>
                      </motion.button>
                    )}
                    {order.status !== 'Pending' && order.status !== 'Delivered' && order.status !== 'Cancelled' && (
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title="تتبع مباشر"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTrackingTarget({ type: 'order', id: order.id, name: \`طلب #\${order.order_number}\` });
                        }}
                        className="text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/40 px-3 py-2 rounded-xl font-black text-[11px] transition-all flex items-center gap-1.5 cursor-pointer flex-1 justify-center"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>تتبع</span>
                      </motion.button>
                    )}
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedOrderId(order.id)}
                      className="text-emerald-700 dark:text-emerald-300 hover:text-white dark:hover:text-white hover:bg-emerald-600 dark:hover:bg-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-2 rounded-xl font-black text-[11px] transition-all border border-emerald-200/50 dark:border-emerald-800/50 inline-flex items-center justify-center gap-1.5 shadow-sm cursor-pointer flex-1 group/btn"
                    >
                      <Eye className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
                      <span>التفاصيل</span>
                    </motion.button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
`;

const updatedContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);

fs.writeFileSync('/app/applet/src/pages/orders/OrdersList.tsx', updatedContent, 'utf-8');
console.log('Successfully updated the table to a vibrant and compact grid of cards.');
