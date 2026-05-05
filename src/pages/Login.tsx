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
  const [rememberMe, setRememberMe] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const navigate = useNavigate();
  const { checkUser } = useAuthStore();

  useEffect(() => {
    const savedEmail = localStorage.getItem('savedAdminEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

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
      
      const { isAdmin, profile } = useAuthStore.getState();
      
      if (profile?.status === 'محظور') {
        await supabase.auth.signOut();
        toast.error('عذراً، هذا الحساب تم إيقافه من قبل الإدارة.');
        return;
      }

      if (!isAdmin) {
        await supabase.auth.signOut();
        toast.error('عذراً، ليس لديك صلاحيات المسؤول للدخول.');
        return;
      }

      if (rememberMe) {
        localStorage.setItem('savedAdminEmail', email);
      } else {
        localStorage.removeItem('savedAdminEmail');
      }

      toast.success('تم تسجيل الدخول بنجاح');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ أثناء تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      toast.error('الرجاء إدخال البريد الإلكتروني أولاً في الحقل المخصص لإرسال رابط استعادة كلمة المرور');
      return;
    }
    try {
      setResetLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/#/reset-password`,
      });
      if (error) throw error;
      toast.success('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح');
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ أثناء إرسال الرابط');
    } finally {
      setResetLoading(false);
    }
  };

  useEffect(() => {
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
    <div className="min-h-screen bg-[#F3F6F9] dark:bg-[#151521] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="sm:mx-auto sm:w-full sm:max-w-md w-full">
        <div className="flex justify-center mb-6">
          {settings?.appLogo ? (
            <img 
              src={settings.appLogo} 
              alt="Logo" 
              className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-full shadow-xl bg-white dark:bg-[#1E1E2D] p-1 border-2 border-emerald-500/20"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-[#5F6F52] to-[#4D5D41] rounded-full flex items-center justify-center text-white font-bold text-4xl shadow-xl shadow-[#5F6F52]/30">
              {settings?.app_name?.charAt(0) || 'Z'}
            </div>
          )}
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          {settings?.app_name || 'زاجل إكسبريس'}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
          أهلاً بك مجدداً في لوحة القيادة
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md w-full">
        <div className="bg-white dark:bg-[#1E1E2D] py-8 px-6 shadow-2xl sm:rounded-2xl sm:px-10 border border-gray-100 dark:border-gray-800">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                البريد الإلكتروني
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 block w-full pr-11 sm:text-sm border-gray-200 dark:border-gray-700 dark:bg-[#2B2B40] dark:text-white rounded-xl py-3 px-4 outline-none transition-all"
                  placeholder="admin@zajelexpress.com"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                كلمة المرور
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 block w-full pr-11 sm:text-sm border-gray-200 dark:border-gray-700 dark:bg-[#2B2B40] dark:text-white rounded-xl py-3 px-4 outline-none transition-all"
                  placeholder="••••••••"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-all hover:-translate-y-0.5"
              >
                {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول إلى النظام'}
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded dark:border-gray-600 dark:bg-[#2B2B40] cursor-pointer"
                />
                <label htmlFor="remember-me" className="mr-2 block text-sm text-gray-900 dark:text-gray-300 cursor-pointer">
                  تذكرني
                </label>
              </div>

              <div className="text-sm">
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={resetLoading}
                  className="font-medium text-emerald-600 hover:text-emerald-500 dark:hover:text-emerald-400 disabled:opacity-50"
                >
                  {resetLoading ? 'جاري الإرسال...' : 'نسيت كلمة المرور؟'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
