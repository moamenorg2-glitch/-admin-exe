# Zajel Express - Admin Dashboard

نظام متكامل لإدارة خدمات التوصيل والمتاجر والمناديب.

## 🚀 التقنيات المستخدمة (Tech Stack)

- **Frontend:** React 19 (Vite), TypeScript, Tailwind CSS.
- **Backend/DB:** Supabase (Auth, PostgreSQL, Storage, Realtime).
- **State Management:** Zustand & TanStack Query (React Query).
- **Desktop/Mobile Deployment:** Electron & Capacitor.
- **Icons & UI:** Lucide React, Framer Motion.

## 📁 هيكل المجلدات (Folder Structure)

- `src/components`: المكونات القابلة لإعادة الاستخدام (UI & Modules).
- `src/pages`: صفحات التطبيق الرئيسية.
- `src/hooks`: الـ Hooks المخصصة لإدارة المنطق المشترك.
- `src/services`: خدمات التعامل مع API و Supabase.
- `src/store`: مخازن الحالة العالمية (Zustand).
- `src/types`: تعريفات TypeScript للحماية البرمجية.
- `src/utils`: دوال مساعدة عامة.

## 🛠️ البدء (Getting Started)

1. **تثبيت التبعيات:**
   ```bash
   npm install
   ```

2. **إعداد متغيرات البيئة:**
   قم بإنشاء ملف `.env` بناءً على `.env.example` وأضف مفاتيح Supabase الخاصة بك.

3. **تشغيل المشروع في وضع التطوير:**
   ```bash
   npm run dev
   ```

4. **بناء نسخة الإنتاج:**
   ```bash
   npm run build
   ```

## 🔒 الأمان وأفضل الممارسات

- يتم استخدام **Row Level Security (RLS)** في Supabase لتأمين البيانات.
- جميع مسارات الأدمن محمية بواسطة `ProtectedRoute`.
- يتم استخدام `Zod` للتحقق من صحة المدخلات في النماذج.

## 📄 دليل المطورين (Developer Guide)

لإضافة ميزة جديدة، يرجى اتباع النمط التالي:
1. تعريف الجدول في قاعدة البيانات وتحديث `database.types.ts`.
2. إنشاء خدمة (Service) في `src/services` للتعامل مع العمليات الأساسية.
3. إنشاء Hook في `src/hooks` لإدارة جلب البيانات والحالة الفورية.
4. بناء المكونات في `src/components` ثم دمجها في الصفحات.

---
بني بحب بواسطة Zajel Team.
