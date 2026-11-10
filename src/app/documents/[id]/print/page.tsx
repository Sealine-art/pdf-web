import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { documentExists } from "@/lib/adobe-ocr";
import PrintDocument from "./print-document";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function PrintFallback() {
  return <main style={{ minHeight: "100svh", display: "grid", placeItems: "center", color: "#555b64", fontFamily: "Arial, Helvetica, sans-serif" }}>Preparing original PDF…</main>;
}

async function PrintPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  await connection();
  if (!(await documentExists(id))) notFound();

  return <PrintDocument documentId={id} />;
}

export default function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<PrintFallback />}><PrintPageContent params={params} /></Suspense>;
}
