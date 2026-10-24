import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { DemoApp } from "@/components/demo/DemoApp";
import "@/components/demo/demo.css";

// The demo deck: how our engine negotiates one case, read from our code and our recorded runs.
// It covers the whole screen (the section rail stays underneath) and has its own look on purpose.

const sans = Inter({ subsets: ["latin"], variable: "--font-demo", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-demo-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Pipeline demo · ProcuDeal",
  description: "How the ProcuDeal engine negotiates a case, step by step: stages, model calls, prompts, RFQ, stop reasons and suppliers.",
};

export default function Page() {
  return (
    <div className={`${sans.variable} ${mono.variable}`}>
      <DemoApp />
    </div>
  );
}
