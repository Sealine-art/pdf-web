export type UploadMetadata = {
  id: string;
  filename: string;
  size: number;
  uploadedAt: string;
};

export type OcrProcessingStatus = {
  status: "not_started" | "processing" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
  totalPages?: number;
  completedPages?: number;
  failedPages?: number;
  warning?: string;
  error?: string;
  conversion?: "native-preserved" | "reconstructed";
};

export type TransientDocument = {
  metadata: UploadMetadata;
  original: Buffer;
  clean?: Buffer;
  status: OcrProcessingStatus;
  processing: boolean;
  lastAccessedAt: number;
};

const DOCUMENT_TTL_MS = 30 * 60 * 1000;
const MAX_MEMORY_BYTES = 256 * 1024 * 1024;

type TransientRegistry = typeof globalThis & {
  __clearpdfTransientDocuments?: Map<string, TransientDocument>;
  __clearpdfTransientCleanupTimer?: ReturnType<typeof setInterval>;
};

const registry = globalThis as TransientRegistry;
const documents = registry.__clearpdfTransientDocuments ??= new Map<string, TransientDocument>();

function storedBytes() {
  let total = 0;
  for (const document of documents.values()) total += document.original.byteLength + (document.clean?.byteLength ?? 0);
  return total;
}

export function pruneTransientDocuments(now = Date.now()) {
  for (const [id, document] of documents) {
    if (!document.processing && now - document.lastAccessedAt >= DOCUMENT_TTL_MS) documents.delete(id);
  }
}

if (!registry.__clearpdfTransientCleanupTimer) {
  registry.__clearpdfTransientCleanupTimer = setInterval(pruneTransientDocuments, 60_000);
  registry.__clearpdfTransientCleanupTimer.unref?.();
}

export function createTransientDocument(metadata: UploadMetadata, originalBytes: Uint8Array) {
  pruneTransientDocuments();
  if (storedBytes() + originalBytes.byteLength > MAX_MEMORY_BYTES) {
    throw new Error("Temporary document memory is full. Close an open document or try a smaller PDF.");
  }

  documents.set(metadata.id, {
    metadata,
    original: Buffer.from(originalBytes),
    status: { status: "not_started" },
    processing: false,
    lastAccessedAt: Date.now(),
  });
}

export function getTransientDocument(id: string) {
  pruneTransientDocuments();
  const document = documents.get(id);
  if (document) document.lastAccessedAt = Date.now();
  return document;
}

export function deleteTransientDocument(id: string) {
  documents.delete(id);
}

export function saveCleanPdf(id: string, cleanBytes: Uint8Array) {
  const document = getTransientDocument(id);
  if (!document) throw new Error("This temporary document session expired. Upload the PDF again.");
  const previousSize = document.clean?.byteLength ?? 0;
  if (storedBytes() - previousSize + cleanBytes.byteLength > MAX_MEMORY_BYTES) {
    throw new Error("Temporary document memory is full. Download or close another document first.");
  }
  document.clean = Buffer.from(cleanBytes);
  document.lastAccessedAt = Date.now();
}

export function saveOcrStatus(id: string, status: OcrProcessingStatus) {
  const document = getTransientDocument(id);
  if (!document) return;
  document.status = status;
  document.lastAccessedAt = Date.now();
}
