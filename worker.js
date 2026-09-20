// EdgePDF serves its UI and, only when needed, streams public PDFs past browser CORS.
// Rendering/editing remain on the device. Never forward cookies or Authorization.
const MAX_PDF_BYTES = 100 * 1024 * 1024;
const MAX_URL_LENGTH = 8000;
const MAX_REDIRECTS = 4;

function error(message, code = 400) {
  return new Response(message, {
    status: code,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function validateTarget(raw, requestUrl, allowedHosts) {
  if (!raw || raw.length > MAX_URL_LENGTH) throw new Error('PDF URL이 없거나 너무 깁니다.');
  let target;
  try { target = new URL(raw); } catch { throw new Error('올바른 PDF URL이 아닙니다.'); }
  if (!['https:', 'http:'].includes(target.protocol)) throw new Error('HTTP(S) URL만 허용됩니다.');
  if (target.username || target.password) throw new Error('URL에 계정 정보를 포함할 수 없습니다.');
  const host = target.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || host.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
      /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)) {
    throw new Error('내부 주소 및 IP 주소는 가져올 수 없습니다.');
  }
  if (target.origin === requestUrl.origin) throw new Error('뷰어 자체 주소는 프록시할 수 없습니다.');
  if (allowedHosts.length && !allowedHosts.some(h => host === h || host.endsWith('.' + h))) {
    throw new Error('이 PDF 호스트는 관리자가 허용하지 않았습니다.');
  }
  target.hash = '';
  return target;
}

function hasPdfSignature(chunks) {
  const sample = new Uint8Array(Math.min(chunks.reduce((n, c) => n + c.length, 0), 1024));
  let offset = 0;
  for (const chunk of chunks) {
    const n = Math.min(chunk.length, sample.length - offset);
    sample.set(chunk.subarray(0, n), offset);
    offset += n;
    if (offset === sample.length) break;
  }
  for (let i = 0; i <= sample.length - 5; i++) {
    if (sample[i] === 37 && sample[i + 1] === 80 && sample[i + 2] === 68 &&
        sample[i + 3] === 70 && sample[i + 4] === 45) return true; // %PDF-
  }
  return false;
}

async function proxyPdf(request, env, url) {
  if (request.method !== 'GET') return error('GET 요청만 허용됩니다.', 405);
  const site = request.headers.get('Sec-Fetch-Site');
  const origin = request.headers.get('Origin');
  const referer = request.headers.get('Referer');
  let refererOrigin = '';
  try { if (referer) refererOrigin = new URL(referer).origin; } catch {}
  // Ordinary browser fetches from this viewer are same-origin; reject cross-site hotlinking.
  if (site && site !== 'same-origin' && site !== 'none') return error('같은 출처의 뷰어에서만 사용할 수 있습니다.', 403);
  if (!site && origin !== url.origin && refererOrigin !== url.origin) return error('뷰어에서 요청해 주세요.', 403);
  if (origin && origin !== url.origin) return error('다른 출처의 요청은 허용되지 않습니다.', 403);

  const allowedHosts = String(env.PDF_PROXY_HOSTS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  let target;
  try { target = validateTarget(url.searchParams.get('url'), url, allowedHosts); }
  catch (e) { return error(e.message); }

  let upstream;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    try {
      upstream = await fetch(target.href, {
        method: 'GET', redirect: 'manual', cache: 'no-store',
        headers: { Accept: 'application/pdf' }
      });
    } catch { return error('원본 서버에 연결할 수 없습니다.', 502); }
    if (![301, 302, 303, 307, 308].includes(upstream.status)) break;
    if (i === MAX_REDIRECTS) { upstream.body?.cancel().catch(() => {}); return error('리디렉션 횟수를 초과했습니다.', 502); }
    const location = upstream.headers.get('Location');
    if (!location) return error('리디렉션 위치가 없습니다.', 502);
    try { target = validateTarget(new URL(location, target).href, url, allowedHosts); }
    catch (e) { return error('리디렉션 거부: ' + e.message, 403); }
    upstream.body?.cancel().catch(() => {});
  }
  if (!upstream.ok || !upstream.body) return error(`원본 서버가 HTTP ${upstream.status} 오류를 반환했습니다.`, 502);
  const knownSize = Number(upstream.headers.get('Content-Length'));
  if (Number.isFinite(knownSize) && knownSize > MAX_PDF_BYTES) {
    upstream.body.cancel().catch(() => {});
    return error('PDF는 최대 100MB까지 가져올 수 있습니다.', 413);
  }

  const reader = upstream.body.getReader();
  const firstChunks = [];
  let total = 0;
  try {
    while (total < 1024 && !hasPdfSignature(firstChunks)) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PDF_BYTES) throw new Error('파일 크기가 100MB를 초과했습니다.');
      firstChunks.push(value);
    }
  } catch {
    reader.cancel().catch(() => {});
    return error('PDF를 읽는 중 오류가 발생했습니다.', 502);
  }
  if (!hasPdfSignature(firstChunks)) {
    reader.cancel().catch(() => {});
    return error('PDF 형식이 아닙니다. 로그인 화면이나 HTML이 반환되었을 수 있습니다.', 415);
  }

  const body = new ReadableStream({
    start(controller) { for (const chunk of firstChunks) controller.enqueue(chunk); },
    async pull(controller) {
      try {
        const { value, done } = await reader.read();
        if (done) { controller.close(); return; }
        total += value.byteLength;
        if (total > MAX_PDF_BYTES) {
          await reader.cancel();
          controller.error(new Error('PDF 용량이 100MB를 초과했습니다.'));
          return;
        }
        controller.enqueue(value);
      } catch (e) { controller.error(e); }
    },
    cancel(reason) { return reader.cancel(reason); }
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="remote.pdf"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') {
      return Response.json({ ok: true, pdfProxy: true, rendering: 'in-browser PDF.js; no fixed 1200 DPI' });
    }
    if (url.pathname === '/api/pdf') return proxyPdf(request, env, url);
    return env.ASSETS.fetch(request);
  }
};