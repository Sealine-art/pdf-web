import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "@/components/arc/foundation.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClearPDF — PDF Document Processing",
  description: "A simple workspace for getting started with scanned and searchable PDFs.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
