import { supabase } from '@/lib/supabase-client';

const BUCKET_NAME = 'motor-images';
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export type UploadResult = {
  path: string;
  publicUrl: string;
  error: string | null;
};

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Format file harus JPG, PNG, atau WEBP.';
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'Ukuran file maksimal 5MB.';
  }
  return null;
}

export async function uploadProductImage(
  productId: string,
  file: File,
  sortOrder: number = 0
): Promise<UploadResult> {
  const validationError = validateImageFile(file);
  if (validationError) {
    return { path: '', publicUrl: '', error: validationError };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${productId}/${Date.now()}-${sortOrder}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    return { path: '', publicUrl: '', error: 'Gagal mengunggah gambar.' };
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName);

  return {
    path: fileName,
    publicUrl: urlData.publicUrl,
    error: null,
  };
}

export async function deleteProductImage(storagePath: string): Promise<{ error: string | null }> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);
  return { error: error ? 'Gagal menghapus gambar.' : null };
}

export async function setPrimaryImage(productId: string, imageId: string): Promise<{ error: string | null }> {
  const { error: resetError } = await supabase
    .from('product_images')
    .update({ is_primary: false })
    .eq('product_id', productId)
    .eq('is_primary', true);

  if (resetError) return { error: 'Gagal mengupdate gambar utama.' };

  const { error: setError } = await supabase
    .from('product_images')
    .update({ is_primary: true })
    .eq('id', imageId);

  return { error: setError ? 'Gagal mengatur gambar utama.' : null };
}

export async function fetchProductImages(productId: string) {
  const { data, error } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });

  if (error) return [];
  return data;
}
