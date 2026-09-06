# PDF Contact Extractor

A complete, temporary-processing workspace for turning PDF documents into editable contact lists. Upload text or scanned PDFs, review names and phone numbers, resolve duplicates, and download Excel or CSV. **No database, account, paid API, or external AI service is required.**

The application includes a Next.js frontend, an Express API, background PDF workers, real offline OCR, validated phone parsing, safe spreadsheet exports, and automated integration/browser tests. The sample buttons use actual PDFs through the same production pipeline—not seeded results.

## Features

- Multiple-file drag-and-drop upload, file validation, individual removal, combined-size limits, and actual upload progress.
- Coordinate-aware PDF text reconstruction with page-by-page OCR fallback, including mixed text/scanned documents.
- Pakistani mobile and fixed-line numbers; explicit international `+` and `00` formats through `libphonenumber-js` metadata.
- Conservative nearby-name matching across labels, inline pairs, visual table rows, and adjacent lines. Missing/uncertain names are **Needs review**, never invented.
- Inline name/phone editing, live validation, search, column sorting, status/source filters, pagination, row selection, bulk deletion, and undo.
- Normalized duplicate detection across files, with an explicit choice of which record to keep. Different names are **not** preselected for removal.
- All/filtered/selected exports to real `.xlsx` workbooks and UTF-8 CSV.
- Secure random temporary files, automatic cleanup on completion/error/cancellation/disconnection, and short-lived in-memory results.
- Responsive desktop/mobile layout, keyboard-accessible dialogs, focus management, live status announcements, and high-contrast text.

## Stack

| Layer         | Technology                                                              |
| ------------- | ----------------------------------------------------------------------- |
| Frontend      | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4             |
| Components    | shadcn-style source-owned Radix primitives, Lucide icons, Sonner toasts |
| Backend       | Node.js 22 LTS, Express 5, TypeScript, Multer 2, Zod                    |
| Text PDFs     | `pdfjs-dist` 5.4, coordinate-aware row reconstruction                   |
| Scanned PDFs  | `@napi-rs/canvas`, Tesseract.js 6, bundled English language data        |
| Phone parsing | `libphonenumber-js/max`                                                 |
| Excel         | SheetJS CE 0.20.3 (`xlsx` is aliased to `@e965/xlsx`)                   |
| Testing       | Vitest, Supertest, pdf-lib fixtures, Playwright, axe-core               |

Fonts are bundled locally; Google Fonts requests are not needed. The SheetJS alias uses the 0.20.3 repack rather than the outdated npm `xlsx@0.18.5`. Keep `@napi-rs/canvas` aligned with PDF.js: this repository pins **0.1.100** to avoid mixing incompatible native canvas instances.

## Quick start

Use **Node.js 22.17+ LTS** (Node 24 is also supported) and npm 10+. A 64-bit Linux/macOS/Windows environment supported by the native canvas package is required. For OCR workloads, start with **2 CPU cores and 2 GB RAM**; lower worker concurrency for smaller hosts.

```bash
npm install
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
npm run dev
```

Open **http://localhost:3000**. The API listens on port **5000**, but browser requests use same-origin `/api` paths through Next.js. Both servers bind to `0.0.0.0` for container and preview compatibility.

**Try a sample** → choose a text or scanned PDF → **Extract contacts** → **Preview contacts**. Review and edit before downloading. Samples are synthetic test data, not real customer records.

### Commands

```bash
npm run dev           # Next.js + watched Express development server
npm run typecheck     # Both TypeScript applications
npm test              # Utility, actual PDF/OCR, API, cleanup and larger-list tests
npm run test:watch    # Watch utility/API tests
npm run build         # Compile the backend and create the production Next.js build
npm start             # Start both production services, with coordinated shutdown
npm run samples       # Regenerate the small, checked-in PDF fixtures
npm run format        # Format source and documentation
npm run format:check  # Check formatting
```

For reproducible installs in CI/deployment, use `npm ci`. `npm start` uses the built-in Node supervisor and does not require dev dependencies, so `npm prune --omit=dev` is supported **after building**.

Individual services can also run with `npm run dev -w frontend`, `npm run dev -w backend`, `npm run start -w frontend`, and `npm run start -w backend`.

## Configuration

The app has working development defaults; environment files are optional. The backend reads `backend/.env` when launched through the root scripts. Next.js reads `frontend/.env.local` and standard production environment files. Never commit real credentials or `.env` files.

### Frontend

| Variable              | Default                 | Meaning                                                                                                                                                                                                        |
| --------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | empty                   | Leave empty for same-origin requests. If deliberately separating origins, supply the API origin (without `/api`) and configure exact backend CORS origins. Public values are compiled into the browser bundle. |
| `API_INTERNAL_URL`    | `http://127.0.0.1:5000` | Server-side proxy destination, without `/api`. Set **before building** for separate-container/service deployments. Never use a private/localhost URL as the browser-facing API URL.                            |
| `FRONTEND_PORT`       | `3000`                  | Optional port for the root production supervisor. Individual frontend scripts use 3000.                                                                                                                        |

### Backend

| Variable                | Default                 | Meaning                                                                                                                                                          |
| ----------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                  | `5000`                  | API listening port                                                                                                                                               |
| `NODE_ENV`              | `development`           | `development`, `test`, or `production`                                                                                                                           |
| `FRONTEND_URL`          | `http://localhost:3000` | Comma-separated exact browser origins                                                                                                                            |
| `ALLOW_PREVIEW_ORIGINS` | true outside production | Allow HTTPS `*.e2b.app` origins for Arena previews. Set **false in production**.                                                                                 |
| `MAX_FILE_SIZE`         | `26214400`              | Bytes per PDF; maximum 25 MiB                                                                                                                                    |
| `MAX_TOTAL_SIZE`        | `104857600`             | Combined file bytes; maximum 100 MiB                                                                                                                             |
| `MAX_FILES`             | `10`                    | PDFs per request; maximum 10                                                                                                                                     |
| `MAX_PAGES`             | `100`                   | Pages per PDF; configurable up to 500, still subject to job timeout                                                                                              |
| `UPLOAD_DIR`            | `backend/uploads`       | Private temporary directory; relative overrides resolve from the backend working directory                                                                       |
| `JOB_TIMEOUT_MS`        | `300000`                | Five-minute processing budget per batch; starts when its worker starts                                                                                           |
| `JOB_TTL_MS`            | `1800000`               | Retain completed in-memory results for up to 30 minutes; may be evicted earlier under load                                                                       |
| `WORKER_CONCURRENCY`    | `2`                     | Active batch workers; allowed range 1–4                                                                                                                          |
| `MAX_QUEUED_JOBS`       | `8`                     | Waiting batches before new uploads receive a busy response                                                                                                       |
| `OCR_LANGUAGE`          | `eng`                   | Tesseract language code(s), e.g. `eng+urd`                                                                                                                       |
| `OCR_LANG_PATH`         | empty                   | Optional directory containing matching compressed `.traineddata.gz` files; English is bundled                                                                    |
| `TRUST_PROXY`           | `0`                     | 0 trusts loopback only, suitable for same-host Next.js. Set a correct trusted hop count only when behind a controlled proxy, and block direct public API access. |
| `AI_PROVIDER`           | `none`                  | Local extraction only; unsupported providers fail startup validation rather than silently sending documents elsewhere                                            |

The hard per-batch contact cap is **10,000**, including duplicates. Exceeding it fails that file with a split-document suggestion instead of silently truncating contacts. Lower server upload limits are obtained by the UI from `/api/health`.

## How extraction works

```text
PDFs → private temporary files → bounded background queue
  → for each PDF / each page:
      validate PDF header and parse document
      reconstruct text rows using PDF text coordinates
      detect insufficient/corrupted text or image-based content
      render the page and run OCR when needed
      normalize whitespace and text
      identify / validate phone candidates
      match nearby names conservatively
  → normalize contact data → mark duplicate groups (do not delete)
  → return contacts for review → export the current edited rows
  → delete original PDFs; expire temporary in-memory results
```

### Phone numbers

These forms normalize to display value `03001234567` and canonical identity `+923001234567`:

```text
03001234567
0300-1234567
0300 1234567
+923001234567
+92 300 1234567
00923001234567
92-300-1234567
```

Pakistani numbers display in national format, preserving `0`. International numbers display in E.164 format. Explicitly labelled invalid candidates are retained as **Invalid number**. Date/ID boundaries, CNIC patterns, and labels such as Invoice, Order, Account, Amount, and Date are excluded. Unlabelled ambiguous numeric data cannot always be perfectly classified; review extracted data against the original.

`backend/src/parsers/phoneExtractor.ts` exports the reusable `validatePhone` utility and accepts a default-country argument. The frontend uses equivalent validation for edits, with a parity test to prevent normalization drift.

### Names and confidence

The parser considers inline fields, name labels, preceding lines, and aligned columns. It removes labels/row numbering and rejects addresses, IDs, common business labels, and prose-like fragments. A non-adjacent match is lower confidence. Blank names remain blank. Values below the confidence threshold are marked **Needs review**.

This is deterministic heuristic extraction, not a claim of universal document understanding. Unusual layouts, heavily skewed/blurred scans, handwriting, repeated headers, or incorrectly ordered PDF text may require manual correction. **No extraction algorithm can guarantee the correct person-number association for every document.**

### OCR

OCR is real, server-side Tesseract.js, not a demo or external API call. Pages render using PDF.js + native canvas, normally at up to 2.4× scale, capped at 12 million pixels and 8,192 pixels per dimension. English recognition data is installed with npm and does not require an internet connection at runtime.

OCR is performed **per page**, so mixed PDFs are supported. Short text-only headers on scanned pages are not sufficient to bypass OCR. OCR is CPU-intensive; lower `WORKER_CONCURRENCY` to reduce memory/CPU use. Password-protected PDFs must be unlocked before uploading. Blank pages and pages with no recognized contacts produce useful warnings. Partial per-page OCR failures in a multi-page document are reported without hiding successfully read pages.

To install other OCR languages, put all requested language files (including English if requesting `eng+urd`) into a private language-data directory, set `OCR_LANG_PATH`, and set `OCR_LANGUAGE`. Fonts/OCR accuracy and script coverage vary. English is the only language bundled by default.

### Duplicates

Only **valid canonical phone numbers** form duplicate groups. `duplicates` counts extra occurrences, not the number of all rows in those groups. Extraction never silently deletes rows. In the review dialog, groups with equivalent or missing names are preselected; groups with different named people require a deliberate decision. Choose the keeper before confirming removal. Undo is available immediately afterward.

## API documentation

All JSON responses include `success`. Errors have a safe message and code:

```json
{
  "success": false,
  "error": {
    "code": "UNSUPPORTED_FILE",
    "message": "Only PDF files are supported. Please choose a .pdf document."
  }
}
```

### `GET /api/health`

Returns `{ success, status: "ok", version, limits }`. Includes `maxFileSize`, `maxTotalSize`, `maxFiles`, and `maxPages`. No private file details are exposed.

### `POST /api/extract`

Multipart form data with one or more repeated **`files`** fields. No other form fields are accepted.

```bash
curl -X POST http://localhost:5000/api/extract \
  -F 'files=@frontend/public/samples/sample-contacts.pdf;type=application/pdf'
```

Returns **202 Accepted**, not a long-running HTTP request:

```json
{
  "success": true,
  "jobId": "a-random-32-character-capability-id",
  "job": {
    "id": "a-random-32-character-capability-id",
    "status": "processing",
    "createdAt": "2026-09-06T12:00:00.000Z",
    "files": [{ "id": "file-uuid", "name": "contacts.pdf", "size": 1859, "stage": "queued", "progress": 0 }]
  }
}
```

Poll the returned ID. The real ID is a cryptographically random, 192-bit, 32-character URL-safe capability. Anyone who possesses it can read that temporary result; do not share it or log it in public analytics. There is intentionally no permanent account/database layer.

### `GET /api/jobs/:id`

Returns `{ success: true, job }`. Poll approximately every second while queued/processing. Job statuses: `queued`, `processing`, `complete`, `failed`, `cancelled`.

File stages: `queued`, `analyzing`, `extracting`, `ocr`, `phones`, `names`, `cleaning`, `complete`, `error`. File records include overall percentage, page counts, OCR use, warnings, and safe per-file errors. A bad PDF does not prevent other PDFs in its batch from being processed.

On completion:

```json
{
  "success": true,
  "job": {
    "id": "…",
    "status": "complete",
    "contacts": [
      {
        "id": "uuid",
        "name": "Muhammad Ali",
        "phone": "03001234567",
        "normalizedPhone": "+923001234567",
        "sourceFile": "contacts.pdf",
        "sourcePage": 1,
        "status": "valid",
        "confidence": 0.97
      }
    ],
    "stats": {
      "total": 1,
      "valid": 1,
      "invalid": 0,
      "needsReview": 0,
      "duplicates": 0,
      "duplicateGroups": 0,
      "filesProcessed": 1
    }
  }
}
```

`valid` counts valid **phone numbers**, including rows with missing names. Contact `status: "valid"` additionally requires a confident name association. `reviewReason` explains uncertain rows. `duplicateGroup`, when present, contains the shared canonical phone. `files` and timestamps are omitted in the abbreviated completion example above.

### `POST /api/jobs/:id/cancel`

Stops a queued/running job and removes its uploads. Returns the cancelled job. If it already finished, returns its existing terminal status. Completed results can be forgotten using DELETE.

### `DELETE /api/jobs/:id`

Cancels work if necessary and immediately forgets its in-memory result. Returns **204**. Idempotent for missing, syntactically valid IDs.

### `POST /api/export`

JSON request using the **edited client-side rows**:

```json
{
  "format": "xlsx",
  "preserveForExcel": true,
  "contacts": [{ "name": "Muhammad Ali", "phone": "03001234567", "sourceFile": "contacts.pdf" }]
}
```

`format` is `xlsx` or `csv`. There must be 1–10,000 contacts; the JSON body cap is 5 MB. Name, phone and source lengths are bounded. Responds with a download attachment such as `extracted-contacts-2026-09-06.xlsx`. There is no automatic export after extraction.

- **Excel:** explicit string cells and `@` text formatting guarantee leading zeroes and `+` prefixes. Column widths and header autofilter are included. Uploaded text never becomes workbook formulas.
- **CSV:** RFC 4180 quoting, UTF-8 BOM, CRLF lines. Spreadsheet-safe mode prefixes phone values with `'`. Text beginning with formula-triggering characters is escaped. Use `preserveForExcel: false` for raw numeric phone strings (the UI calls this disabling spreadsheet-safe mode).
- **CSV caveat:** CSV has no cell types. Its raw contents retain zeroes, but Excel may infer numeric types when opening it. Spreadsheet-safe CSV may display the prefix in some importers; use **XLSX** for an unambiguous, clean phone display in Excel, or explicitly import CSV phone columns as text.

### Limits and errors

- Upload: 20 requests / 15 minutes / client IP.
- Export: 20 requests / minute / client IP.
- Status/cancellation/deletion: 240 requests / minute / client IP.
- `400`: invalid request; `403`: rejected origin; `404`: unknown/expired job; `413`: too large; `415`: unsupported upload; `429`: rate limit; `503`: queue full.
- Content-invalid PDFs are accepted into a job, then reported through its per-file processing error. Stack traces are logged on the server, not returned to the browser.

## Security and data lifecycle

1. Original filenames are sanitized for display only. Files on disk use random UUID filenames, `0600` permissions, and a directory restricted to `0700`.
2. Extension/MIME and actual PDF header checks, parser validation, page/pixel/contact/request caps, queue bounds, rate limiting, CORS, and security headers apply.
3. PDFs are treated strictly as data. PDF JavaScript is not run, PDF.js dynamic evaluation is disabled, and no shell command uses an uploaded filename or document content.
4. Temporary files are removed after each file finishes and again during job finalization. Errors, timeouts, explicit cancellation, and interrupted uploads trigger cleanup. Old random upload files left by a hard crash are swept on startup; dedicated ephemeral storage is recommended.
5. Job results are in process memory, with unguessable IDs and a default 30-minute TTL. They may be evicted earlier when retention limits are reached. API responses use `Cache-Control: no-store`.
6. Browser edits are held only in the current React session, not cookies, localStorage, or IndexedDB. Closing/reloading clears them. “New extraction” also requests deletion of the server result. Downloaded exports remain on the user’s device.
7. No external AI processing, tracking analytics, or permanent contact history is enabled. Only upload documents you have permission to process.

Worker threads protect responsiveness and provide termination/heap limits; they are **not an operating-system security sandbox**, and native canvas/WASM allocations are not fully limited by V8 heap limits. For public deployment use a non-root container, explicit CPU/memory/disk budgets, network restrictions as appropriate, timely dependency updates, TLS, and a reverse-proxy request body limit. Authentication/organization quotas and malware scanning may be added for a multi-tenant deployment.

## Production deployment

### Single host / container

```bash
npm ci
npm run build
# Set the real external origin and keep preview-origin access disabled.
NODE_ENV=production FRONTEND_URL=https://contacts.example.com ALLOW_PREVIEW_ORIGINS=false npm start
```

Terminate the supervisor with SIGTERM/SIGINT for coordinated worker shutdown and upload cleanup. Put the frontend behind a TLS reverse proxy; keep port 5000 internal. Set the reverse proxy upload limit to at least 105 MB to accommodate multipart framing. Allow approximately two minutes for upload transfer; processing occurs through asynchronous job polling, not a five-minute HTTP response.

### Docker Compose

```bash
docker compose up --build -d
# For a real deployment:
FRONTEND_URL=https://contacts.example.com docker compose up --build -d
```

The provided image runs as a non-root user, includes offline OCR dependencies, and exposes only port 3000. Compose adds an ephemeral, non-executable upload mount, a 2 GB memory limit, 2 CPUs, and conservative concurrency/queue settings. Add a TLS reverse proxy in front of it. **The Docker configuration is provided for deployment; build/run it in your target Docker environment before releasing.**

### Separate services

Deploy the Express backend to a long-running Node/container service with writable ephemeral disk and worker-thread support. Deploy Next.js to a compatible Node service and build it with `API_INTERNAL_URL` set to the backend’s private service URL. The browser should still use relative `/api` URLs. Use a correct `TRUST_PROXY` configuration and do not expose trusted-proxy-only API ports directly.

Many edge/serverless platforms have short execution limits, small upload limits, no writable native runtime, or no long-lived worker process support. **Do not deploy this OCR backend as an edge function.** If the frontend host cannot proxy 25 MB PDFs, use a properly configured API origin instead, or introduce signed object-storage uploads as a separate architecture change.

### Scaling and optional persistence

The basic deployment is **one API process**. Queues/results/rate-limit stores are intentionally in-memory. Do not randomly distribute job polling across independent replicas. Horizontal scaling requires an external durable queue, shared ephemeral/object storage, shared rate limiting, and a result store (or sticky routing with its availability trade-offs).

Persistent history is intentionally not implemented. Add an optional MongoDB repository adapter only with explicit retention consent, authentication, encryption/access controls, and deletion policies. Keep temporary processing the default.

## Testing

```bash
npm test
npm run typecheck
npm run build

# With the app running (npm run dev, or npm start after building):
npx playwright install chromium
npm run test:e2e
```

For Linux sandboxes where the normal browser CDN or system packages are unavailable, a dev-only Chromium bundle is included:

```bash
USE_BUNDLED_CHROMIUM=1 npm run test:e2e
```

The fallback extracts its runtime libraries to the OS temporary directory; browser assets are not committed. CI runs utility/API tests, production build, formatting checks, and browser tests against `npm start`.

Tests cover Pakistani/international formats, normalization parity with edits, conservative names/column association, invalid numeric exclusions, duplicate decisions, formula-safe CSV, real XLSX cell types, corrupted/blank/page-limited PDFs, actual text/scanned/mixed PDF processing, concurrent multi-file REST workflows, cancellation/timeouts/disconnections, rate limits, secure cleanup, and a 2,000-contact extraction/export batch. Browser tests exercise editing, filtering, sorting, pagination, duplicate review, bulk deletion/undo, real downloads, mobile OCR, and safe error states. Fixtures are small and synthetic.

## Project layout

```text
frontend/
  app/                    App Router pages, metadata, styles and error states
  components/dashboard/   Workspace, upload/progress, editable table, review/export dialogs
  components/ui/          Source-owned Radix/shadcn-style primitives
  hooks/                  Upload/job polling/cancellation lifecycle
  lib/                    API client, edit validation, contact statistics
  types/                  Typed API contracts
  public/samples/         Real text and scanned example PDFs
backend/
  src/
    controllers/          Extraction/jobs and download handlers
    routes/               REST endpoints and endpoint rate limits
    middleware/           Secure streaming Multer storage, cleanup, safe errors
    parsers/              Phone/name heuristics and parser-provider interface
    services/             PDF/OCR, normalization, duplicates, export, worker queue
    workers/              Isolated extraction entry and dev/production bootstrap
    utils/                Sanitization and safe errors
    app.ts                Testable Express application factory
    server.ts             Startup and graceful shutdown
  tests/                  Unit/integration/OCR tests and synthetic fixtures
  uploads/                Ignored private temporary files
scripts/                  Production supervisor and PDF sample generator
tests/e2e/                Real browser workflow tests
Dockerfile / compose.yaml Production container configuration
```

### Optional AI parser extension

`backend/src/parsers/parserProvider.ts` defines `ContactParser` and the local implementation. Add a provider behind this interface, explicitly register allowed `AI_PROVIDER` values in the configuration schema, and keep the default `none`. Require user consent before sending extracted text externally, validate provider responses against the source text, retain source-page/confidence metadata, and obtain credentials only through deployment environment variables. No placeholder AI request or hidden provider call is enabled.

## Troubleshooting

| Problem                              | What to check                                                                                                                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty results                        | Read each file’s warnings. The PDF may contain no supported phone numbers, an unusual layout, or a low-quality scan. Try the real sample PDFs to verify installation.                         |
| Scanned PDF fails                    | Check Node version/native canvas installation and server logs. Keep the pinned compatible canvas/PDF.js versions. English language data is bundled; custom languages require `OCR_LANG_PATH`. |
| Password-protected PDF               | Remove the password in your PDF editor, save a new copy, then upload. Passwords are not requested or stored.                                                                                  |
| Long OCR run                         | Use upright, sharp scans; split larger files; reduce concurrent workers. A batch exceeding the processing budget is terminated and cleaned up.                                                |
| Upload rejected                      | PDF only; 25 MB/file, 100 MB/batch, 10 files by default. Proxies may impose an additional request limit. A .pdf extension alone is insufficient.                                              |
| Connection/CORS error                | Confirm both services are running and `GET /api/health` works through the frontend origin. Use relative browser URLs, correct `API_INTERNAL_URL` at build time, and exact `FRONTEND_URL`.     |
| Shared rate-limit errors             | Configure the actual trusted proxy chain and keep the backend private. Never blindly trust arbitrary client-supplied forwarding headers.                                                      |
| Native canvas error                  | Run `npm ci` on the target operating system/architecture; do not copy `node_modules` from another OS. Use the provided Debian-based container if needed.                                      |
| Result expired                       | Upload again. Results are temporary; export before closing/reloading the tab. Edited browser rows can still be exported after the server’s original job expires.                              |
| CSV loses zeroes                     | Use Excel export, enable spreadsheet-safe CSV, or import the CSV phone column explicitly as text. CSV itself cannot carry spreadsheet cell types.                                             |
| Dev browser cannot download Chromium | Use the documented Linux bundled-browser fallback. This does not affect the application or OCR runtime.                                                                                       |

## License

MIT. See [LICENSE](LICENSE).
