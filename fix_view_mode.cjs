const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/orders/OrdersList.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const tableCode = `      ) : (
        <div className={cn("bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-opacity duration-300", isFetching && !isLoading ? "opacity-60" : "")}>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-gray-50/50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">الطلب</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">العميل</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">المتجر / المندوب</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">المالية</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">الحالة</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">جاري التحميل...</td>
                  </tr>
                ) : sortedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">لا توجد طلبات تطابق معايير البحث</td>
                  </tr>
                ) : (
                  sortedOrders.map((order) => {
                    const delay = getDelayStatusForOrder(order);
                    return (
                      <tr key={order.id} className={cn("hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors", delay.isDelayed ? "bg-red-50/30 dark:bg-red-900/10" : "")}>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-black text-gray-900 dark:text-white">#{order.order_number}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-bold flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {format(new Date(order.created_at), 'PPpp', { locale: ar })}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-emerald-50 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                              {order.customer?.avatar_url ? <img src={order.customer.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                            </div>
                            <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{order.customer?.full_name || 'غير معروف'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                              <Store className="w-3.5 h-3.5 text-emerald-500" />
                              <span>{order.sub_orders?.length > 1 ? order.sub_orders.length + ' متاجر' : (order.sub_orders?.[0]?.vendor?.brand_name || 'متجر غير معروف')}</span>
                            </div>
                            {order.delivery_team && order.delivery_team.length > 0 ? (
                              <div className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 group cursor-pointer" onClick={() => setInfoModal({ type: 'driver', data: { ...order.delivery_team[0].driver?.user }})}>
                                <Motorbike className="w-3.5 h-3.5" />
                                <span>{order.delivery_team[0].driver?.user?.full_name}</span>
                              </div>
                            ) : (
                              !['Completed', 'Cancelled', 'Rejected'].includes(order.status) && (
                                <button onClick={(e) => { e.stopPropagation(); setAssigningDriverOrderId(order.id); }} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md w-fit">تعيين مندوب</button>
                              )
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-black text-gray-900 dark:text-white">{order.grand_total} ج.م</span>
                            <span className={cn("px-1.5 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider w-fit", paymentMethodStyles[order.payment_method] || 'bg-gray-50 text-gray-600')}>{order.payment_method || 'نقداً'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button onClick={() => setSelectedHistoryOrder(order)} className={cn("px-3 py-1.5 inline-flex items-center gap-1.5 text-xs font-black rounded-xl border uppercase shadow-sm whitespace-nowrap", statusColors[order.status as OrderStatus], "dark:bg-opacity-20")}>
                            {statusNames[order.status as OrderStatus]}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {order.status === 'Pending' && (
                              <button onClick={() => handleQuickAccept(order.id)} className="text-white bg-amber-500 hover:bg-amber-600 px-2 py-1.5 rounded-lg font-black text-xs transition-all flex items-center gap-1">
                                <Store className="w-3.5 h-3.5" /> قبول
                              </button>
                            )}
                            <button onClick={() => setSelectedOrderId(order.id)} className="text-emerald-700 bg-emerald-50 px-2 py-1.5 rounded-lg font-black text-xs transition-all border border-emerald-200 flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" /> تفاصيل
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
`;

content = content.replace('{/* Cards Grid */}\n      <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 transition-opacity duration-300", isFetching && !isLoading ? "opacity-60" : "")}>', `      {/* View Container */}
      {viewMode === 'grid' ? (
        <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 transition-opacity duration-300", isFetching && !isLoading ? "opacity-60" : "")}>`);

content = content.replace(/          \)\)\s*\n        \)\}\s*\n      <\/div>/, `          ))
        )}
      </div>\n${tableCode}`);

fs.writeFileSync(filePath, content);
console.log('updated');
