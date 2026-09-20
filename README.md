# Edge PDF Viewer

An Edge-inspired PDF viewer built for Cloudflare Workers. The Worker serves static assets; PDF contents are opened, rendered, edited and exported **in your browser**, without uploading the document to this Worker.

## Run locally

```bash
npm install
npm run dev
```

## Deploy to Cloudflare Workers

Sign in using `npx wrangler login`, then run:

```bash
npm run deploy
```

Deploying through a connected Git repository is also possible in the Cloudflare dashboard; choose a Workers project and use `npm run deploy` as the deploy command. The repository contains `wrangler.jsonc` and a Worker entrypoint.

## Features

- Open local PDFs, drag and drop, or load publicly accessible HTTP(S) URLs when their server permits browser CORS. URL downloads are limited to 100 MB.
- Navigate with page number, thumbnails, PDF outline, fit-to-page, fit-width, zoom, rotate and fullscreen.
- Select and copy PDF text using an approximate text overlay; search document text and navigate between results (page navigation, not highlighted result rectangles).
- Draw ink, highlight, erase strokes, create/edit/delete notes and undo the most recent annotation on the current page.
- Export a PDF with annotations flattened into its pages. Korean notes are drawn as rasterized images so their visible characters can be preserved, but cannot be text-selected in the exported PDF.
- Open an annotated PDF in a new browser tab for printing, and read selected or current-page text with browser speech synthesis.
- Autosave the most recently opened PDF and session annotations using local IndexedDB, with a restoration prompt when you return.

## Quality, privacy and limitations

**This is not a fixed 1200 DPI renderer and does not implement tiled raster rendering.** PDF.js retains source vector quality and re-renders as you zoom. Onscreen page canvases are capped at 16 million pixels and a device-pixel ratio of 2; canvases far outside the viewport are released. On unusually large or complex documents, the browser may still be slow. A separate high-memory PDF rendering service would be needed for genuine full-page 1200 DPI raster output.

There is no server-side arbitrary-URL proxy. Browser CORS, PDF access restrictions and encrypted file permissions still apply. Scanned PDFs need OCR for text search and speech synthesis; OCR is not included. Text selection on complex layouts may be imperfect. Notes and pen marks are flattened rather than exported as editable PDF annotation objects; very long note text may be clipped on export. A changed rotation applies to every page. Printing opens the generated annotated PDF; use that tab's PDF print control or Ctrl+P. Autosaved content is stored only in the current browser and may be cleared by browser storage policies. PDF.js and pdf-lib modules currently load from pinned external CDNs and require an internet connection.
