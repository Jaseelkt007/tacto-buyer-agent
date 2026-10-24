import type { Metadata } from "next";
import { AppRail } from "@/components/AppRail";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProcuDeal · Hollerau Pumpenwerke",
  description: "ProcuDeal buyer agent for the Tacto Negotiation Arena.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex h-dvh flex-col sm:flex-row">
        <AppRail />
        <div className="min-h-0 min-w-0 flex-1">{children}</div>
      </body>
    </html>
  );
}
