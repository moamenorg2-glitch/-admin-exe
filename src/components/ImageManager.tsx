import React, { useState } from 'react';
import { Loader2, Upload, Trash2, Edit } from 'lucide-react';
import toast from 'react-hot-toast';
import { handleGlobalError } from '../utils/errorHandler';
import { getApiUrl } from '../utils/apiUtils';

interface ImageManagerProps {
  bucket: string;
  path: string;
  currentImageUrl?: string;
  onImageChanged: (newUrl: string) => void;
  disabled?: boolean;
}

export const ImageManager: React.FC<ImageManagerProps> = ({ bucket, path, currentImageUrl, onImageChanged, disabled }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>, isUpdate: boolean) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', bucket);
    formData.append('path', path);

    try {
      const endpoint = getApiUrl(isUpdate ? '/api/admin/update' : '/api/admin/upload');
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errData = await response.json();
          throw new Error(errData.message || 'Failed to upload image');
        } else {
          const text = await response.text();
          console.error("Upload error response:", text);
          throw new Error(`Server returned non-JSON response (${response.status})`);
        }
      }
      
      const data = await response.json();
      const publicUrl = data.publicUrl || `${(import.meta as any).env.VITE_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
      
      onImageChanged(publicUrl);
      toast.success('تم رفع الصورة بنجاح');
    } catch (error) {
      handleGlobalError(error, 'ImageManager.handleUpload');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(getApiUrl('/api/admin/delete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket, paths: [path] }),
      });

      if (!response.ok) throw new Error('Failed to delete image');
      
      onImageChanged('');
      toast.success('تم حذف الصورة بنجاح');
    } catch (error) {
      handleGlobalError(error, 'ImageManager.handleDelete');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {currentImageUrl && (
        <div className="relative h-16 w-16 border rounded-md overflow-hidden">
          <img src={currentImageUrl} alt="Product" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          {!disabled && (
            <button 
              onClick={handleDelete}
              disabled={isDeleting}
              className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded-bl-md"
            >
              {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            </button>
          )}
        </div>
      )}
      
      {!disabled && (
        <label className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 ml-2" />}
          <span>{currentImageUrl ? 'تغيير' : 'رفع'}</span>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            disabled={isUploading}
            onChange={(e) => handleUpload(e, !!currentImageUrl)}
          />
        </label>
      )}
    </div>
  );
};
