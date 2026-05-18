import { supabase } from '../lib/supabase';

export async function deleteFromCloudinary(publicId) {
  try {
    await supabase.functions.invoke('delete-cloudinary-file', {
      body: { public_id: publicId },
    });
  } catch (e) {
    console.warn('Cloudinary delete failed (continuing):', e);
  }
}
