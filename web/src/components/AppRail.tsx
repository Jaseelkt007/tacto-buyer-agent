"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BoxesIcon, ChartIcon, CogIcon, ContractIcon, DatabaseIcon, FactoryIcon, FileIcon, HandshakeIcon, HomeIcon, InboxIcon, PulseIcon, ScaleIcon } from "./icons";

// One entry per section of the site; add new pages here.
const SECTIONS: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/intro", label: "Intro", icon: <HandshakeIcon width={20} height={20} /> },
  { href: "/", label: "Home", icon: <HomeIcon width={20} height={20} /> },
  { href: "/demo", label: "Case story", icon: <FileIcon width={20} height={20} /> },
  { href: "/live", label: "Demo", icon: <PulseIcon width={20} height={20} /> },
  { href: "/mail", label: "Mail", icon: <InboxIcon width={20} height={20} /> },
  { href: "/suppliers", label: "Suppliers", icon: <FactoryIcon width={20} height={20} /> },
  { href: "/parts", label: "Parts", icon: <CogIcon width={20} height={20} /> },
  { href: "/market", label: "Market", icon: <ChartIcon width={20} height={20} /> },
  { href: "/contracts", label: "Contracts", icon: <ContractIcon width={20} height={20} /> },
  { href: "/demand", label: "Demand", icon: <BoxesIcon width={20} height={20} /> },
  { href: "/negotiations", label: "Deals", icon: <HandshakeIcon width={20} height={20} /> },
  { href: "/arguments", label: "Arguments", icon: <ScaleIcon width={20} height={20} /> },
  { href: "/facts", label: "Facts", icon: <DatabaseIcon width={20} height={20} /> },
];

export function AppRail() {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections" className="app-rail">
      <Link href="/" className="app-rail-brand" aria-label="ProcuDeal home" title="ProcuDeal · engine v1.9">
        PD
      </Link>
      <div className="app-rail-links">
        {SECTIONS.map((s) => {
          const active = s.href === "/" ? pathname === "/" : pathname.startsWith(s.href);
          return (
            <Link
              key={s.href}
              href={s.href}
              aria-current={active ? "page" : undefined}
              className="app-rail-link"
            >
              {s.icon}
              {s.label}
            </Link>
          );
        })}
      </div>
      <div className="app-rail-version" aria-label="Buyer engine version 1.9">
        <span>Engine</span>
        <strong>v1.9</strong>
      </div>
    </nav>
  );
}
