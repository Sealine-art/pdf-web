# ClearPDF

ClearPDF is a Next.js 16 App Router application for uploading, viewing, annotating, editing, printing, and OCR-processing PDFs. Uploaded files and results stay in a bounded, temporary server-memory session; scanned PDFs use Adobe PDF Services when server credentials are configured.

## Requirements

- Node.js 24.x
- pnpm 11.25.0 (available through Corepack)
- Enough memory for transient PDF sessions
- Adobe PDF Services credentials for scanned-document OCR

## Local development

From this directory:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open <http://localhost:3000>. In development, sign-in is enabled when both access variables are set; otherwise auth is bypassed for local development.

## Google AI Studio Build mode

This is a Next.js full-stack application. Import the repository into AI Studio Build mode with **Import from GitHub** so the Node.js server and Next.js API routes are included; importing only the static `src` folder will not provide upload/OCR APIs. The development command binds Next.js to `0.0.0.0` so the AI Studio preview proxy can reach it. The PDF picker uses a native label-to-input association for reliable activation inside an embedded preview. Upload security accepts the preview's same-origin Fetch Metadata if its gateway rewrites the server-visible host, and enforces the 101 MB multipart limit while reading requests even when the gateway omits `Content-Length`.

Uploads are held in server memory only, expire after 30 minutes of inactivity, and are discarded when you use **Back**. No `CLEARPDF_DATA_DIR` is needed. Add `APP_BASIC_AUTH_USER` and `APP_BASIC_AUTH_PASSWORD` in AI Studio's server-side environment to enable the website sign-in page in preview. Add `PDF_SERVICES_CLIENT_ID` and `PDF_SERVICES_CLIENT_SECRET` there to enable Adobe OCR. Never place these credentials in client-side code.

To confirm the Node API is running in the preview, open `/api/health`; it should return `{"ok":true}`. This checks the API route, not whether storage is durable.

AI Studio publishes Build mode applications to Cloud Run. The transient cache is local to one Node.js instance; restarting or scaling to another instance can end the session, so this design does not provide durable document history or reliable multi-instance sessions. For those requirements, connect shared storage and a database. OCR scans are sent to Adobe PDF Services, which temporarily handles the uploaded/generated assets; the app requests Adobe to delete those assets after processing.

## Configuration

Copy `.env.example` to `.env.local` for local settings. Do not commit `.env.local` or production environment files.

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_BASIC_AUTH_USER` | Production; optional in development | Username for the website sign-in page. |
| `APP_BASIC_AUTH_PASSWORD` | Production; optional in development | Strong server-side password for the website sign-in page. |
| `PDF_SERVICES_CLIENT_ID` | For Adobe OCR | Adobe PDF Services API client ID (server only). |
| `PDF_SERVICES_CLIENT_SECRET` | For Adobe OCR | Adobe PDF Services API client secret (server only). |
| `PDF_SERVICES_OCR_LOCALE` | No | Adobe OCR language locale; defaults to `en-US`. |

Set production values in the hosting platform's secret/environment-variable settings. Never use a `NEXT_PUBLIC_` prefix for secrets. Scanned PDFs are sent to Adobe Document Cloud for processing. OCR can misread poor scans; users should verify extracted financial and shipping values against the original.

The production sign-in is a single shared operator account, not per-user authentication or a multi-tenant authorization system. It uses an HttpOnly session cookie that expires after eight hours. Keep the service behind HTTPS and an access-controlled reverse proxy until proper user accounts and per-document authorization are implemented.

## Checks and production build

```bash
pnpm check
pnpm build
pnpm start
```

`pnpm check` runs ESLint and TypeScript checks. The repository does not currently include an automated unit or end-to-end test runner. `pnpm build` produces a standalone Next.js server. `pnpm start` starts the production server on port 3000.

## Storage and deployment architecture

The application keeps original PDFs, OCR results, metadata, and processing status in a bounded in-memory cache. Documents expire after 30 minutes without activity; selecting **Back** deletes the active session immediately. Restarting the Node.js process discards all documents. This provides temporary processing without writing uploaded PDFs to local disk, but it intentionally does not provide durable history. On Cloud Run, requests for an active document must reach the same live instance; a restart or instance change can end the session.

Uploads are limited to 100 MB. Configure any reverse proxy/load balancer request-body limit to at least 101 MB to accommodate multipart form data. The upload and OCR request limits currently live in process memory, so they reset on restart and are not a substitute for edge-level abuse protection.

### Docker

Build from this directory:

```bash
docker build -t clearpdf .
```

Copy `.env.example` to `.env.production`, fill in the production secrets, and pass those values through a protected environment file or your container platform's secret manager (never bake them into the image):

```bash
docker run --name clearpdf --restart unless-stopped -p 3000:3000 --env-file .env.production clearpdf
```

Place the app behind an HTTPS reverse proxy. Keep `.env.production` out of Git. The container runs as a non-root user and listens on port 3000. Document data is held in process memory and is discarded on restart or after the inactivity timeout.

## GitHub

Before pushing, review `git status`, confirm `.env*` files other than `.env.example` and `.data` remain ignored, and verify the configured remote and repository access. Never commit uploaded documents, production secrets, or generated build output.
