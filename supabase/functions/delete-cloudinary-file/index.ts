import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { public_id } = await req.json();
    if (!public_id) return new Response(JSON.stringify({ error: 'public_id required' }), { status: 400, headers: CORS });

    const cloudName  = Deno.env.get('CLOUDINARY_CLOUD_NAME')!;
    const apiKey     = Deno.env.get('CLOUDINARY_API_KEY')!;
    const apiSecret  = Deno.env.get('CLOUDINARY_API_SECRET')!;

    // Build signed deletion request
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Generate SHA-1 signature
    const toSign = `public_id=${public_id}&timestamp=${timestamp}${apiSecret}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(toSign);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    const form = new FormData();
    form.append('public_id', public_id);
    form.append('api_key', apiKey);
    form.append('timestamp', timestamp);
    form.append('signature', signature);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
      { method: 'POST', body: form }
    );

    const json = await res.json();
    return new Response(JSON.stringify(json), {
      status: res.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
