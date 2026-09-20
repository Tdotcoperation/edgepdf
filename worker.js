// Cloudflare Worker: static web assets only. Documents stay on the user's device.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') {
      return Response.json({ ok: true, rendering: 'browser PDF.js, lazy pages, capped per-page canvas; not 1200 DPI' });
    }
    return env.ASSETS.fetch(request);
  }
};
