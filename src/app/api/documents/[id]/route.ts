import { deleteTransientDocument, getTransientDocument } from "@/lib/storage";
import { isSameOriginRequest } from "@/lib/request-guards";
import { NextResponse } from "next/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  const document = getTransientDocument(id);
  if (!document) return NextResponse.json({ error: "Document not found or temporary session expired." }, { status: 404 });
  return NextResponse.json(document.metadata, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "This document request was rejected." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  deleteTransientDocument(id);
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
