# Edge PDF Viewer

An Edge-inspired PDF viewer built for Cloudflare Workers. Local PDFs stay in your browser. When opening a remote PDF, the browser tries the original URL first and falls back to the Worker streaming proxy only when the direct request fails, such as due to CORS. The Worker **fetches PDF bytes, not renders the PDF**: PDF.js still renders and edits on the device.

## Run / deploy

```bash
npm install
npm run dev
# After npx wrangler login:
npm run deploy
```

The repository includes `wrangler.jsonc`, `worker.js` and static assets in `public/`. For Git-connected Workers deployments, set the deploy command to `npm run deploy`.

## Automatically open a PDF with an address-bar parameter

Open the deployed viewer with a URL of this form:

```text
https://YOUR-WORKER.workers.dev/?url=https%3A%2F%2Fexample.com%2Fbook.pdf
```

The query parameter is `url`; `pdf` is accepted as an alias. Use `encodeURIComponent(pdfUrl)` when constructing links, especially for PDF addresses containing `?` or `&`:

```js
const link = `${viewerOrigin}/?url=${encodeURIComponent('https://example.com/book.pdf?page=1&download=1')}`;
```

If the URL parameter is present, that PDF is opened automatically rather than prompting to restore the previous browser draft. You can also use the **URL** button to open a remote PDF manually.

### How the CORS fallback works

1. Browser tries `fetch(originalPdfUrl)` directly.
2. Only if that request rejects (CORS/network or mixed-content failure), it requests `/api/pdf?url=ENCODED_ORIGINAL_URL` from the same-origin Worker.
3. Worker validates the target and redirects, fetches the public PDF without forwarding browser cookies or Authorization headers, checks the PDF signature, and streams at most 100 MB back with a PDF content type.
4. PDF.js opens the returned bytes in the browser. Browser local-file uploads, edits and IndexedDB drafts are not sent to the Worker.

**Limits:** This does not bypass logins, subscriptions, authorization, bot protection or upstream blocks on Cloudflare requests. If the remote site replies with HTML instead of a PDF, the proxy rejects it. The browser must still be able to load the viewer's external PDF.js/pdf-lib modules. Some servers disallow even server-side requests. A direct HTTP 403/404 is reported as such and does not trigger the CORS fallback.

**Security:** Only public HTTP(S) hostnames are allowed; IP-literal, localhost/internal targets, same-origin targets, credential-bearing URLs and redirects to these are rejected. Only same-origin viewer browser requests may use the proxy. Size is capped at 100 MB and responses are not cached. For public deployments, strongly consider restricting allowed PDF hostnames with a comma-separated Wrangler environment variable `PDF_PROXY_HOSTS`, e.g. `books.example.org,cdn.example.org`; its absence allows arbitrary public hostnames. Do not include private passwords or signed access tokens in shareable viewer URL parameters: URLs may appear in browser history and request logs. This is not an authentication service or an open unrestricted proxy.

## Other features

- Open local PDFs and drag and drop; thumbnails, PDF outline and page navigation.
- Fit, zoom, rotation, fullscreen, text selection/search and browser TTS.
- Pen, highlighter, eraser, notes, undo, annotated PDF export and printing.
- Autosave the last document and annotations to the browser's IndexedDB.

## Quality / known limitations

**Fixed 1200 DPI and tiled raster rendering are not implemented.** PDF.js preserves the source vector graphics and re-renders on zoom; canvases are limited to 16 million pixels per page and device-pixel ratio 2, and off-screen canvases are released to reduce browser memory load. The proxy does not increase rendering quality or memory available to the browser. Scanned PDFs need OCR for search and speech, which is not included. Text layout/selection can be imperfect on complex PDFs. Ink/notes export as flattened graphics, not editable PDF annotation objects. External CDN modules require an internet connection. Automatic saving is local to the current browser and can be cleared by its storage policies.
