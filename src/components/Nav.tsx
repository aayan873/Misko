"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/practice", label: "Practice" },
  { href: "/spot-the-mistake", label: "Spot the Mistake" },
  { href: "/compare", label: "Compare" },
  { href: "/dashboard", label: "Dashboard" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-40 border-b border-chalk-border bg-chalk-bg">
      <div className="mx-auto flex max-w-[1080px] items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-chalk-accent font-display text-[15px] font-semibold text-chalk-bg">
            M
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-chalk-ink">Misko</span>
        </Link>
        <div className="flex items-center gap-1">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3.5 py-2 text-[14px] font-medium transition-colors ${
                pathname === link.href
                  ? "bg-chalk-accent-wash text-chalk-accent"
                  : "text-chalk-ink-soft hover:bg-chalk-surface hover:text-chalk-ink"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
