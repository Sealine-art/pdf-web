import { randomUUID } from "node:crypto";
import { createTransientDocument, type UploadMetadata } from "@/lib/storage";
import { NextResponse } from "next/server";
import { consumeRateLimit, isSameOriginRequest } from "@/lib/request-guards";

const MAX_PDF_SIZE = 100 * 1024 * 1024;
const MAX_MULTIPART_SIZE = MAX_PDF_SIZE + 1024 * 1024;
const UPLOAD_RATE_LIMIT = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function safeFilename(filename: string) {
  const basename = filename.replaceAll("\\", "/").split("/").pop() ?? "document.pdf";
  return basename.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 180) || "document.pdf";
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "This upload request was rejected." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = contentLengthHeader && /^\d+$/.test(contentLengthHeader) ? Number(contentLengthHeader) : null;
  if (contentLengthHeader && contentLength === null) {
    return NextResponse.json({ error: "The upload request has an invalid content length." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  if (contentLength !== null && (!Number.isSafeInteger(contentLength) || contentLength > MAX_MULTIPART_SIZE)) {
    return NextResponse.json({ error: "PDFs must be 100 MB or smaller." }, { status: 413 });
  }

  const rateLimit = consumeRateLimit("pdf-upload", UPLOAD_RATE_LIMIT, RATE_LIMIT_WINDOW_MS);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "The upload limit has been reached. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds), "Cache-Control": "no-store" } },
    );
  }

  let form: FormData;
  try {
    // Content-Length can be stripped by preview proxies; Next's proxy body
    // buffer is configured to cap the complete multipart payload at 101 MB.
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "The upload could not be read. Check the PDF size and retry." }, { status: 400 });
  }

  const entry = form.get("file");
  if (!(entry instanceof File)) {
    return NextResponse.json({ error: "Choose a PDF file to upload." }, { status: 400 });
  }

  const filename = safeFilename(entry.name);
  if (!filename.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are accepted." }, { status: 415 });
  }
  if (entry.size === 0) {
    return NextResponse.json({ error: "This PDF is empty." }, { status: 400 });
  }
  if (entry.size > MAX_PDF_SIZE) {
    return NextResponse.json({ error: "PDFs must be 100 MB or smaller." }, { status: 413 });
  }

  const bytes = Buffer.from(await entry.arrayBuffer());
  if (!bytes.subarray(0, 1024).includes(Buffer.from("%PDF-"))) {
    return NextResponse.json({ error: "The selected file does not contain a valid PDF header." }, { status: 415 });
  }

  const metadata: UploadMetadata = {
    id: randomUUID(),
    filename,
    size: entry.size,
    uploadedAt: new Date().toISOString(),
  };
  try {
    createTransientDocument(metadata, bytes);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The PDF could not be held temporarily. Please retry the upload." },
      { status: 507 },
    );
  }

  return NextResponse.json(metadata, { status: 201 });
}
