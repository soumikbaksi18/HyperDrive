"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";
import { cn } from "@/lib/cn";
import { monadChain } from "@/lib/wagmi";

const NAV = [
  {
    href: "/dashboard",
    label: "Dashboard",
    subtitle: "Holdings and wallet",
    icon: LayoutDashboard,
  },
  {
    href: "/portfolio",
    label: "Portfolio",
    subtitle: "Positions and PnL",
    icon: PieChart,
  },
  {
    href: "/markets",
    label: "Markets",
    subtitle: "Nasdaq xStocks on Monad",
    icon: TrendingUp,
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pathSeen, setPathSeen] = useState(pathname);
  const desktopSearchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  if (pathname !== pathSeen) {
    setPathSeen(pathname);
    setMobileOpen(false);
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const narrow = window.matchMedia("(max-width: 767px)").matches;
        setCollapsed(false);
        setMobileOpen(narrow);
        window.setTimeout(() => {
          (narrow ? mobileSearchRef : desktopSearchRef).current?.focus();
        }, 40);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const crumbs =
    pathname.startsWith("/markets")
      ? [
          { label: "Dashboard", href: "/dashboard" },
          { label: "Markets" },
        ]
      : pathname.startsWith("/portfolio")
        ? [
            { label: "Dashboard", href: "/dashboard" },
            { label: "Portfolio" },
          ]
        : [{ label: "Dashboard" }];

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const next = query.trim();
    router.push(next ? `/markets?q=${encodeURIComponent(next)}` : "/markets");
    setMobileOpen(false);
  };

  const sidebar = (mobile: boolean) => (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-white/10 bg-[#0c0914]/95 backdrop-blur-xl",
        mobile ? "w-[280px]" : collapsed ? "w-16" : "w-[260px]",
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-white/10 px-3">
        {(!collapsed || mobile) && (
          <Link href="/dashboard" className="min-w-0 px-1">
            <Wordmark markClassName="size-7" />
          </Link>
        )}
        {collapsed && !mobile && (
          <Link href="/dashboard" className="mx-auto" aria-label="Dashboard">
            <LogoMark className="size-7" />
          </Link>
        )}
        {!mobile && (
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className={cn(
              "rounded-lg p-1.5 text-white/45 hover:bg-white/5 hover:text-white",
              collapsed && "mx-auto",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
        )}
        {mobile && (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/5"
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {(!collapsed || mobile) && (
        <form onSubmit={submitSearch} className="border-b border-white/10 p-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-white/35" />
            <input
              ref={mobile ? mobileSearchRef : desktopSearchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Nasdaq"
              className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] pr-14 pl-9 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-300/40"
            />
            <kbd className="absolute top-1/2 right-2 -translate-y-1/2 rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-white/35">
              ⌘K
            </kbd>
          </label>
        </form>
      )}

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-3">
        {(!collapsed || mobile) && (
          <p className="px-2 pb-1 text-[10px] font-semibold tracking-[0.16em] text-white/35 uppercase">
            Navigation
          </p>
        )}
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition",
                collapsed && !mobile ? "justify-center" : "",
                active
                  ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(196,181,253,0.28)]"
                  : "text-white/55 hover:bg-white/[0.04] hover:text-white",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  active ? "bg-violet-400/20 text-violet-100" : "bg-white/[0.05]",
                )}
              >
                <Icon className="size-4" />
              </span>
              {(!collapsed || mobile) && (
                <span className="min-w-0 text-left">
                  <span className="block leading-tight">{item.label}</span>
                  <span className="block truncate text-[11px] font-normal text-white/35">
                    {item.subtitle}
                  </span>
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {(!collapsed || mobile) && (
        <div className="border-t border-white/10 px-4 py-4 text-xs leading-relaxed text-white/40">
          Buy on Markets with USDC. Positions and PnL live on Portfolio.
        </div>
      )}
    </aside>
  );

  return (
    <div className="fixed inset-0 flex bg-[#09070f] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem]" />
      <div className="pointer-events-none absolute top-0 right-0 h-[55%] w-[60%] bg-[radial-gradient(ellipse_at_top_right,rgba(124,58,237,0.28),transparent_62%)]" />

      <div className="relative hidden md:flex">{sidebar(false)}</div>
      {mobileOpen && (
        <div className="absolute inset-0 z-40 flex md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 h-full">{sidebar(true)}</div>
        </div>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#09070f]/80 px-4 backdrop-blur-xl md:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-white/10 text-white/70 md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="size-4" />
            </button>
            <nav aria-label="Breadcrumb" className="min-w-0 text-xs">
              <ol className="flex items-center gap-2">
                {crumbs.map((crumb, index) => (
                  <li key={crumb.label} className="flex min-w-0 items-center gap-2">
                    {index > 0 && <span className="text-white/25">/</span>}
                    {crumb.href ? (
                      <Link href={crumb.href} className="text-white/45 hover:text-white">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="truncate font-medium text-white">
                        {crumb.label}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          </div>
          <ConnectWalletButton />
        </header>

        <main className="min-h-0 flex-1 overflow-auto">{children}</main>

        <footer className="flex h-9 shrink-0 items-center justify-between border-t border-white/10 bg-[#09070f]/90 px-4 text-[11px] text-white/40">
          <span>
            {monadChain.name} · chain {monadChain.id}
          </span>
          <span className="hidden sm:inline">MetaMask · Nasdaq xStocks</span>
        </footer>
      </div>
    </div>
  );
}
