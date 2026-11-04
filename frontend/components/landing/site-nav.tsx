"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Wordmark } from "@/components/brand/logo";
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#baskets", label: "Baskets" },
  { href: "/#drawdown", label: "Drawdowns" },
  { href: "/markets", label: "Markets" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="absolute inset-x-0 top-0 z-40">
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center gap-4 px-5 md:px-8">
        <Link href="/" className="shrink-0" aria-label="Hyperdrive home">
          <Wordmark />
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-6 xl:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-white/75 transition hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:block">
            <ConnectWalletButton />
          </div>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-semibold text-[#2a1458] shadow-[0_8px_30px_rgba(255,255,255,0.18)] transition hover:bg-violet-50"
          >
            Launch application
          </Link>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 text-white xl:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="mx-4 rounded-3xl border border-white/10 bg-[#160c28]/90 p-4 backdrop-blur-xl xl:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-sm text-white/80"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="mt-3 md:hidden">
            <ConnectWalletButton className="w-full justify-center" />
          </div>
        </div>
      )}
    </header>
  );
}
