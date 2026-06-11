import { supabase } from '@/lib/supabase'

/**
 * Attempts to delete a Cloudinary asset via the edge function.
 * Logs on failure but does not throw — callers proceed with DB cleanup
 * even when CDN removal fails (avoids orphaned DB records for CDN errors).
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('delete-cloudinary-file', {
      body: { public_id: publicId },
    })
    if (error) {
      console.warn('[deleteFromCloudinary] Edge function error:', error)
      return
    }
    // The edge function proxies the Cloudinary response — result 'ok' means success
    const result = (data as { result?: string; error?: string } | null) ?? {}
    if (result.error) {
      console.warn('[deleteFromCloudinary] Cloudinary error:', result.error)
    }
  } catch (e) {
    console.warn('[deleteFromCloudinary] Network error (continuing):', e)
  }
}
