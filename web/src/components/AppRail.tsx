"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BoxesIcon, ChartIcon, CogIcon, ContractIcon, DatabaseIcon, FactoryIcon, HandshakeIcon, HomeIcon, InboxIcon, ScaleIcon } from "./icons";

// One entry per section of the site; add new pages here.
const SECTIONS: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/", label: "Home", icon: <HomeIcon width={20} height={20} /> },
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
    <nav
      aria-label="Sections"
      className="flex shrink-0 flex-col items-center gap-1 border-r border-[var(--line)] bg-[var(--rail)] py-2 max-sm:w-full max-sm:flex-row max-sm:overflow-x-auto max-sm:border-r-0 max-sm:border-b max-sm:px-2 sm:w-16"
    >
      {SECTIONS.map((s) => {
        const active = s.href === "/" ? pathname === "/" : pathname.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex w-[60px] flex-col items-center gap-0.5 rounded-md py-1.5 text-[10.5px] ${
              active ? "bg-[var(--select)] font-semibold text-[var(--accent-ink)]" : "text-[var(--ink-2)] hover:bg-[var(--hover)]"
            }`}
          >
            {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-[var(--accent)] max-sm:hidden" />}
            {s.icon}
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
