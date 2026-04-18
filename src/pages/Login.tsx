import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { Lock, Mail } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { checkUser } = useAuthStore();

  const { data: settings } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('appLogo, app_name')
        .single();
      if (error) throw error;
      return data;
    }
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      await checkUser();
      
      const isAdmin = useAuthStore.getState().isAdmin;
      if (!isAdmin) {
        await supabase.auth.signOut();
        toast.error('عذراً، ليس لديك صلاحيات المسؤول للدخول.');
        return;
      }

      toast.success('تم تسجيل الدخول بنجاح');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ أثناء تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      
      // نستخدم رابطاً لا يحتوي على الهاش في سوبابيس لضمان التوافق
      // المسار هو /auth-callback (بدون هاش) ولكن المفاعل سيعالجه
      const redirectTo = `${window.location.origin}/#/auth-callback`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      
      if (data?.url) {
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        window.open(
          data.url,
          'google_login_popup',
          `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
        );
      }
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ أثناء تسجيل الدخول بجوجل');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // الاستماع لرسالة النجاح من النافذة المنبثقة
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SUPABASE_AUTH_SUCCESS') {
        checkUser().then(() => {
          const isAdmin = useAuthStore.getState().isAdmin;
          if (isAdmin) {
            toast.success('تم تسجيل الدخول بجوجل بنجاح');
            navigate('/');
          }
        });
      }
    };

    window.addEventListener('message', handleMessage);

    // الاستماع لتغييرات حالة المصادقة (كخيار احتياطي)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await checkUser();
        const isAdmin = useAuthStore.getState().isAdmin;
        if (isAdmin) {
          toast.success('تم تسجيل الدخول بنجاح');
          navigate('/');
        } else {
          await supabase.auth.signOut();
          toast.error('عذراً، ليس لديك صلاحيات المسؤول للدخول.');
        }
      }
    });

    return () => {
      window.removeEventListener('message', handleMessage);
      subscription.unsubscribe();
    };
  }, [navigate, checkUser]);

  useEffect(() => {
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#F3F6F9] dark:bg-[#151521] flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-4">
          {settings?.appLogo ? (
            <img 
              src={settings.appLogo} 
              alt="Logo" 
              className="w-20 h-20 object-contain rounded-2xl shadow-lg"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg shadow-emerald-500/30">
              {settings?.app_name?.charAt(0) || 'Z'}
            </div>
          )}
        </div>
        <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          {settings?.app_name || 'زاجل إكسبريس'}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
          تسجيل الدخول للوحة الإدارة
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-[#1E1E2D] py-8 px-4 shadow-sm sm:rounded-2xl sm:px-10 border border-gray-100 dark:border-gray-800">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                البريد الإلكتروني
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus:ring-emerald-500 focus:border-emerald-500 block w-full pr-10 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-[#2B2B40] dark:text-white rounded-md py-2 px-3 border"
                  placeholder="admin@zajelexpress.com"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                كلمة المرور
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-emerald-500 focus:border-emerald-500 block w-full pr-10 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-[#2B2B40] dark:text-white rounded-md py-2 px-3 border"
                  placeholder="••••••••"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
              >
                {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-[#1E1E2D] text-gray-500 dark:text-gray-400">
                  أو سجل الدخول عبر
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-white bg-white dark:bg-[#2B2B40] hover:bg-gray-50 dark:hover:bg-[#353550] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors disabled:opacity-50"
              >
                <svg className="h-5 w-5 ml-2" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3.09c-2.14-1.927-4.918-3.09-7.91-3.09-5.454 0-10.054 3.328-11.97 8.114l5.236 1.65z"
                  />
                  <path
                    fill="#34A853"
                    d="M16.04 18.013c-1.09.593-2.418.914-3.84.914-2.82 0-5.28-1.573-6.527-3.89l-5.237 1.65c2.31 4.75 7.155 7.95 12.804 7.95 3.037 0 5.855-1.127 8.018-3.027l-5.218-1.597z"
                  />
                  <path
                    fill="#4285F4"
                    d="M19.83 12c0-.66-.06-1.32-.16-1.96H12v3.82h4.41c-.19.98-.75 1.83-1.58 2.37l5.218 1.597c3.04-2.82 4.79-6.98 4.79-11.827z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.673 15.037A7.056 7.056 0 0 1 4.909 12a7.056 7.056 0 0 1 .764-3.037l-5.236-1.65C.154 8.78 0 10.36 0 12c0 1.64.154 3.22.437 4.687l5.236-1.65z"
                  />
                </svg>
                جوجل
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
