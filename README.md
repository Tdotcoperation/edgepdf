# Edge PDF Viewer

Edge-inspired PDF viewer for Cloudflare Workers. The Worker serves the static web app; PDFs are processed in your browser, not uploaded to the server.

## Run

```bash
npm install
npm run dev
```

Deploy after logging in with `npx wrangler login`:

```bash
npm run deploy
```

## Features

Open a local PDF or drag and drop one, open public URLs that allow CORS, thumbnails and document outline, pagination, zoom, fit, rotation and full screen. Pen, highlighter, eraser, sticky notes, browser text search and speech synthesis, annotated PDF export, original PDF printing and local IndexedDB draft restoration.

## Quality and limitations

This version **does not implement fixed 1200 DPI or tiled raster rendering**. PDF.js re-renders vector source content as you zoom. Each onscreen page canvas is limited to 16 million pixels and device-pixel ratio 2; non-visible pages are released to reduce memory pressure. PDFs are not rendered server-side. Some scanned or protected documents require OCR or permissions, which are not included. Text selection is approximate for complex layouts. Export flattens ink and basic note labels; non-ASCII note text (including Korean) is not faithfully embedded in the exported PDF. Printing opens the original PDF, so download the annotated PDF first when you need annotations printed. Files and changes are saved locally in your browser, subject to storage availability; nothing is synchronized between devices. External JavaScript modules require internet connectivity.

The app deliberately does not provide an open arbitrary-URL server-side PDF proxy, because the browser fetch respects the remote server's CORS and access permissions.
