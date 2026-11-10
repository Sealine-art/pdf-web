import { getTransientDocument } from "@/lib/storage";
import { NextResponse } from "next/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  const document = getTransientDocument(id);
  if (!document) return NextResponse.json({ error: "Document not found or temporary session expired." }, { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const safeName = encodeURIComponent(document.metadata.filename).replaceAll("'", "%27");
  return new NextResponse(new Uint8Array(document.original), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${safeName}`,
      "Content-Length": String(document.original.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
