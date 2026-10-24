import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Purchasing mail · Hollerau Pumpenwerke",
  description: "What the ProcuDeal buyer agent sees when a negotiation case opens.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full">{children}</body>
    </html>
  );
}
