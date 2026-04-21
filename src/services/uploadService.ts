import { supabaseAdmin, isAdminKeyAvailable } from '../lib/supabaseAdmin';
import { supabase } from '../lib/supabase';

export const uploadService = {
  /**
   * Uploads a file directly to Supabase Storage bypassing the backend server.
   * This is required for the standalone APK/EXE to work independently.
   * @param file The file object to upload
   * @param bucket The storage bucket name (e.g., 'profiles', 'products')
   * @param path The path/filename inside the bucket
   * @returns { publicUrl, path }
   */
  async uploadFile(file: File, bucket: string, path: string) {
    // Determine which client to use -> Use Admin if available to bypass RLS policies during admin tasks
    const client = isAdminKeyAvailable ? supabaseAdmin : supabase;

    const { data, error } = await client.storage
      .from(bucket)
      .upload(path, file, { 
        upsert: true,
        cacheControl: '3600'
      });

    if (error) {
       console.error("Storage upload error:", error);
       if (error.message.includes('Bucket not found') || error.message.includes('The resource was not found')) {
         throw new Error(`تعذر الرفع: تأكد من أن حاوية التخزين (Bucket) باسم "${bucket}" موجودة في إعدادات Supabase Storage وأنها عامة (Public).`);
       }
       throw new Error(error.message || 'فشل في رفع الصورة');
    }

    const { data: publicUrlData } = client.storage
      .from(bucket)
      .getPublicUrl(path);

    return {
      path: data.path,
      publicUrl: publicUrlData.publicUrl
    };
  },

  async deleteFile(bucket: string, path: string) {
    const client = isAdminKeyAvailable ? supabaseAdmin : supabase;
    const { error } = await client.storage.from(bucket).remove([path]);
    if (error) throw error;
    return true;
  }
};
