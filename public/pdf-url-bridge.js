// Loaded before app.js. Leave ordinary network requests alone, only proxy a PDF
// selected in the URL dialog or via ?url= when its direct fetch fails (e.g. CORS).
(() => {
  const originalFetch = window.fetch.bind(window);
  const query = new URLSearchParams(location.search);
  const initialUrl = query.get('url') || query.get('pdf');
  let selectedUrl = null;

  // An explicit URL wins over an unrelated older IndexedDB draft on startup.
  if (initialUrl) {
    const originalConfirm = window.confirm.bind(window);
    window.confirm = message =>
      String(message).includes('이 브라우저에 자동 저장된 PDF 작업이 있습니다.') ? false : originalConfirm(message);
  }

  window.fetch = async (input, options) => {
    const href = input instanceof Request ? input.url : input instanceof URL ? input.href : String(input);
    if (!selectedUrl || href !== selectedUrl) return originalFetch(input, options);
    try {
      return await originalFetch(input, options);
    } catch (directError) {
      // HTTP errors are returned normally. This path is for browser network/CORS failures.
      if (!(directError instanceof TypeError)) throw directError;
      const status = document.getElementById('statusText');
      if (status) status.textContent = '직접 연결 실패 · Workers를 통해 PDF 가져오는 중…';
      const response = await originalFetch('/api/pdf?url=' + encodeURIComponent(href), {
        method: 'GET', credentials: 'same-origin',
        headers: { Accept: 'application/pdf' },
        signal: options?.signal || (input instanceof Request ? input.signal : undefined)
      });
      if (!response.ok) {
        const message = (await response.text()).slice(0, 240);
        throw new Error('Workers PDF 가져오기 실패 (HTTP ' + response.status + '): ' + message);
      }
      return response;
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('urlForm');
    const input = document.getElementById('urlInput');
    if (!form || !input) return;
    // Capture happens before app.js's onsubmit handler starts fetching.
    form.addEventListener('submit', () => {
      try { selectedUrl = new URL(input.value).href; }
      catch { selectedUrl = null; }
    }, true);
    if (initialUrl) {
      input.value = initialUrl;
      form.requestSubmit();
    }
  });
})();