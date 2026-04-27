const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

/**
 * Upload a file to Cloudinary using an unsigned upload preset.
 * Uses XMLHttpRequest to support upload progress callbacks.
 */
export const uploadToCloudinary = (file, folder, onProgress) => {
  let xhr;
  const promise = new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', `workboard/${folder}`);

    xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        resolve({
          url: data.secure_url,
          publicId: data.public_id,
          size: data.bytes,
          format: data.format,
        });
      } else {
        let msg = `Upload failed (${xhr.status})`;
        try {
          const err = JSON.parse(xhr.responseText);
          if (err?.error?.message) msg = err.error.message;
        } catch (_) {}
        console.error('Cloudinary error:', xhr.status, xhr.responseText);
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('cancelled'));
    xhr.send(formData);
  });

  return { promise, abort: () => xhr?.abort() };
};

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'heic'];
const PDF_EXTS   = ['pdf'];
const DOC_EXTS   = ['doc', 'docx', 'txt', 'rtf', 'odt', 'pages'];
const SHEET_EXTS = ['xls', 'xlsx', 'csv', 'numbers'];
const VIDEO_EXTS = ['mp4', 'mov', 'avi', 'webm', 'mkv'];

export const getFileType = (fileName = '') => {
  const ext = fileName.split('.').pop().toLowerCase();
  if (IMAGE_EXTS.includes(ext)) return 'image';
  if (PDF_EXTS.includes(ext))   return 'pdf';
  if (DOC_EXTS.includes(ext))   return 'document';
  if (SHEET_EXTS.includes(ext)) return 'spreadsheet';
  if (VIDEO_EXTS.includes(ext)) return 'video';
  return 'other';
};

export const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const isImageType = (fileType) => fileType === 'image';
export const isPdfType   = (fileType) => fileType === 'pdf';
