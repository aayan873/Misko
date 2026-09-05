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
      <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" className="flex flex-none items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-chalk-accent font-display text-[15px] font-semibold text-chalk-bg">
            M
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-chalk-ink">Misko</span>
        </Link>
        {/* min-w-0 overrides a flex item's default auto min-width, which is what
            actually let this row push the whole page wider than the viewport
            before — with it removed, this can shrink and scroll horizontally
            instead. 5 links plus the wordmark above don't fit a phone-width
            screen otherwise. Looks identical to before on wide screens, where
            there's room and no scrolling is needed. */}
        <div className="scrollbar-hide flex min-w-0 items-center gap-1 overflow-x-auto">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex-none rounded-lg px-3.5 py-2 text-[14px] font-medium whitespace-nowrap transition-colors ${
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
