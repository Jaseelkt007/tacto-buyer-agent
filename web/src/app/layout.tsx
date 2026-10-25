import type { Metadata } from "next";
import localFont from "next/font/local";
import { AppRail } from "@/components/AppRail";
import "./globals.css";

const geist = localFont({
  src: "./fonts/Geist.woff2",
  variable: "--font-geist",
  weight: "100 900",
  display: "swap",
});
const geistMono = localFont({
  src: "./fonts/GeistMono.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ProcuDeal · Hollerau Pumpenwerke",
  description: "ProcuDeal buyer agent for the Tacto Negotiation Arena.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-dvh flex-col sm:flex-row">
        <AppRail />
        <div className="min-h-0 min-w-0 flex-1">{children}</div>
      </body>
    </html>
  );
}
