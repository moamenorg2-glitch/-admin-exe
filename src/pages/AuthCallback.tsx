import { useEffect } from 'react';

export default function AuthCallback() {
  useEffect(() => {
    // هذه الصفحة وظيفتها فقط إرسال رسالة للنافذة الأم وإغلاق نفسها
    if (window.opener) {
      window.opener.postMessage({ type: 'SUPABASE_AUTH_SUCCESS' }, '*');
      window.close();
    } else {
      // إذا تم فتحها مباشرة، انتقل للرئيسية
      window.location.href = '#/';
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#151521]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">جاري إكمال تسجيل الدخول...</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">سيتم إغلاق هذه النافذة تلقائياً</p>
      </div>
    </div>
  );
}
