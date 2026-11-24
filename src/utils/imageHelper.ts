/**
 * Client-side image validation, safe URL verification, and canvas compression utilities
 * to ensure uploaded photos stay safely within Firestore document size limits.
 */

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  outputMimeType?: 'image/jpeg' | 'image/webp' | 'image/png';
}

/**
 * Validates an uploaded image File by MIME type and byte size.
 */
export function validateImageFile(file: File, maxSizeMB = 5): ImageValidationResult {
  if (!file) {
    return { valid: false, error: 'لم يتم اختيار ملف صورة.' };
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
    return {
      valid: false,
      error: 'نوع الملف غير مدعوم. يرجى اختيار صورة بصيغة JPG أو PNG أو WEBP أو GIF.',
    };
  }

  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `حجم الصورة يتجاوز الحد المسموح (${maxSizeMB} ميجابايت).`,
    };
  }

  return { valid: true };
}

/**
 * Compresses and resizes an image File via Canvas into a base64 Data URL.
 */
export function compressImageToDataUrl(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<string> {
  const {
    maxWidth = 640,
    maxHeight = 640,
    quality = 0.8,
    outputMimeType = 'image/jpeg',
  } = options;

  return new Promise((resolve, reject) => {
    const validation = validateImageFile(file, 10);
    if (!validation.valid) {
      reject(new Error(validation.error || 'ملف صورة غير صالح'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة.'));
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        reject(new Error('ملف الصورة فارغ.'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('تعذر تحميل الصورة للمعالجة.'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
        const targetWidth = Math.max(1, Math.round(img.width * scale));
        const targetHeight = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        try {
          const compressed = canvas.toDataURL(outputMimeType, quality);
          resolve(compressed);
        } catch {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Validates that an image URL uses a safe scheme (https, http, root-relative path, or raster data URL).
 */
export function isSafeImageUrl(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(trimmed)) return true;
  return false;
}

/**
 * Compresses user profile avatar photos tightly (256x256) so they fit safely
 * in Firestore user documents alongside all profile metadata.
 */
export async function compressAvatarImage(file: File): Promise<string> {
  return compressImageToDataUrl(file, {
    maxWidth: 256,
    maxHeight: 256,
    quality: 0.72,
    outputMimeType: 'image/jpeg',
  });
}

