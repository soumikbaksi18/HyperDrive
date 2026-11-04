import Link from "next/link";
import {
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Wallet,
  Waypoints,
} from "lucide-react";
import { Wordmark } from "@/components/brand/logo";
import { SiteNav } from "@/components/landing/site-nav";
import { formatCatalogDate } from "@/lib/format";
import { nasdaqCatalog } from "@/lib/xstocks";

const TAPE = [
  ["AAPLx", "Apple"],
  ["NVDAx", "NVIDIA"],
  ["MSFTx", "Microsoft"],
  ["TSLAx", "Tesla"],
  ["AMZNx", "Amazon"],
  ["METAx", "Meta"],
  ["GOOGLx", "Alphabet"],
  ["AMDx", "AMD"],
  ["AVGOx", "Broadcom"],
  ["NFLXx", "Netflix"],
] as const;

const STEPS = [
  {
    index: "01",
    title: "Connect MetaMask on Monad",
    body: "Hyperdrive talks to the MetaMask extension and asks it to use Monad mainnet, chain 143. Your keys stay in the wallet.",
  },
  {
    index: "02",
    title: "Agents propose a few baskets",
    body: "Instead of a single hot pick, the agent prepares a small set of baskets from Nasdaq names that exist as xStocks on Monad.",
  },
  {
    index: "03",
    title: "You fund one basket",
    body: "The money you choose to allocate goes into the basket you approve. Hyperdrive does not move it into a different basket on its own.",
  },
  {
    index: "04",
    title: "A falling market stays visible",
    body: "Equity baskets can fall. The drawdown is meant to stay on the dashboard, with the original basket intact until you approve a change.",
  },
];

const BASKETS = [
  {
    name: "Steady Explorer",
    tone: "Lower relative volatility",
    note: "Broader Nasdaq names. Still equities, so this is not a cash-like holding.",
  },
  {
    name: "Balanced Growth",
    tone: "Mixed profile",
    note: "Established companies beside faster growers, with a cap on any one name.",
  },
  {
    name: "High-Growth Explorer",
    tone: "Higher relative volatility",
    note: "Theme-heavy names. The downside case is part of the basket, not a footnote.",
  },
];

const QUESTIONS = [
  {
    q: "What is an xStock here?",
    a: "An xStock is a tokenized version of a listed stock or ETF from the xStocks programme. On Hyperdrive, the markets page lists only Nasdaq-listed underlyings that the xStocks API reports as deployed on Monad. A token is not the same as holding the share, and it does not include voting rights.",
  },
  {
    q: "Does Launch application place a trade?",
    a: "No. Launch application opens the Hyperdrive dashboard. MetaMask can connect and switch to Monad. Basket construction and any later allocation still need a separate confirmation. This version does not submit a swap.",
  },
  {
    q: "What happens if the market falls?",
    a: "The funded basket is marked down. Hyperdrive is designed to keep that drawdown visible and to leave the basket as you approved it. Moving into a different, lower-volatility basket is a new decision, not an automatic rescue.",
  },
  {
    q: "Where do the stock listings come from?",
    a: `The markets catalog is the public xStocks asset list, filtered to exchange MIC XNAS and a Monad deployment. This copy was read at ${formatCatalogDate(nasdaqCatalog.fetchedAt)}. Quotes on the markets page are requested live from the xStocks price-data endpoint and are reference prices, not an offer.`,
  },
];

export function HomePage() {
  const tape = [...TAPE, ...TAPE];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#140a28] text-white">
      <section className="relative isolate min-h-[100svh] overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 520px at 50% -10%, rgba(255,255,255,0.38), transparent 55%), radial-gradient(700px 480px at 85% 18%, rgba(167,139,250,0.55), transparent 60%), radial-gradient(640px 420px at 12% 24%, rgba(109,40,217,0.7), transparent 62%), linear-gradient(180deg, #7c5cbf 0%, #5b35a8 34%, #3a1d78 68%, #140a28 100%)",
          }}
        />
        <div className="pointer-events-none absolute -left-20 top-32 size-72 rounded-full bg-fuchsia-300/20 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-24 size-80 rounded-full bg-violet-200/20 blur-3xl" />
        <SiteNav />

        <div className="relative mx-auto grid min-h-[100svh] max-w-7xl items-center gap-14 px-5 pb-24 pt-32 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:pt-28">
          <div className="max-w-xl">
            <p className="rise inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-xs text-white/80 backdrop-blur">
              <Sparkles className="size-3.5 text-violet-100" />
              {nasdaqCatalog.count} Nasdaq xStocks reported on Monad
            </p>
            <h1 className="rise mt-6 text-5xl leading-[1.02] font-medium tracking-tight sm:text-6xl md:text-7xl [animation-delay:80ms]">
              A few baskets.
              <span className="mt-1 block font-serif text-[0.92em] italic text-white/95">
                Then the one you fund.
              </span>
            </h1>
            <p className="rise mt-6 max-w-lg text-base leading-relaxed text-white/75 sm:text-lg [animation-delay:140ms]">
              Hyperdrive’s agents screen Nasdaq companies wrapped as xStocks
              on Monad and suggest a handful of baskets. You choose where the
              money goes. If the market falls, that basket is marked down in
              the open — it is not quietly replaced.
            </p>
            <div className="rise mt-8 flex flex-wrap items-center gap-3 [animation-delay:200ms]">
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#2a1458] shadow-[0_10px_40px_rgba(255,255,255,0.2)] transition hover:bg-violet-50"
              >
                Launch application
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/markets"
                className="inline-flex h-12 items-center rounded-full border border-white/20 bg-white/10 px-5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/15"
              >
                See Nasdaq markets
              </Link>
            </div>
            <dl className="rise mt-10 grid max-w-lg grid-cols-3 gap-4 text-left [animation-delay:260ms]">
              {[
                ["Chain", "Monad 143"],
                ["Wallet", "MetaMask"],
                ["Universe", "Nasdaq"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                    {label}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-white">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rise relative [animation-delay:180ms]">
            <div className="glass-card relative overflow-hidden rounded-[28px] p-4 sm:p-5">
              <div className="flex items-center justify-between px-2 pb-4">
                <div>
                  <p className="text-xs text-white/55">Preview</p>
                  <p className="text-lg font-medium">Basket desk</p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/70">
                  Not a live allocation
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-3xl bg-gradient-to-br from-[#d8ccff] via-[#8b6cff] to-[#5b35c9] p-5 text-[#1c1038]">
                  <p className="text-xs font-medium text-[#2a1458]/70">
                    Next basket
                  </p>
                  <p className="mt-6 font-serif text-4xl italic leading-none">
                    Waiting
                  </p>
                  <p className="mt-3 text-sm text-[#241447]/80">
                    Three ideas. One approval. No silent switch if prices drop.
                  </p>
                  <div className="mt-8 flex items-end justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#2a1458]/60">
                        Holdings
                      </p>
                      <p className="text-2xl font-semibold">—</p>
                    </div>
                    <Wave />
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
                    <div className="flex items-center justify-between text-xs text-white/55">
                      <span>Session</span>
                      <span>Monad</span>
                    </div>
                    <p className="mt-3 text-2xl font-semibold tracking-tight">
                      MetaMask
                    </p>
                    <p className="mt-1 text-xs text-white/50">
                      Connect, then switch to chain 143.
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs text-white/55">On the desk today</p>
                    <ul className="mt-3 space-y-2 text-sm">
                      <li className="flex items-center justify-between">
                        <span>Dashboard</span>
                        <span className="text-white/45">Shell</span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span>Markets</span>
                        <span className="text-violet-200">Live list</span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span>Baskets</span>
                        <span className="text-white/45">Next</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="border-y border-white/10 bg-[#10081f]">
        <div className="overflow-hidden py-4">
          <div className="ticker-track flex w-max gap-8 pr-8">
            {tape.map(([symbol, name], index) => (
              <Link
                key={`${symbol}-${index}`}
                href={`/markets?q=${symbol.replace(/x$/, "")}`}
                className="flex items-center gap-3 text-sm text-white/70 hover:text-white"
              >
                <span className="font-mono text-violet-200">{symbol}</span>
                <span>{name}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <section id="how" className="mx-auto max-w-7xl px-5 py-24 md:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
            How Hyperdrive works
          </p>
          <h2 className="mt-3 text-4xl font-medium tracking-tight sm:text-5xl">
            The agent suggests.{" "}
            <span className="font-serif italic text-violet-100">You decide.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/60">
            The point of a basket is to avoid handing a beginner one ticker and
            calling it a portfolio. Hyperdrive keeps the choice small, explained,
            and reversible only by you.
          </p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {STEPS.map((step) => (
            <article key={step.index} className="app-card rounded-3xl p-6">
              <p className="font-mono text-xs text-violet-300">{step.index}</p>
              <h3 className="mt-4 text-xl font-medium">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/60">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="baskets" className="mx-auto max-w-7xl px-5 pb-8 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
              Basket shapes
            </p>
            <h2 className="mt-3 text-4xl font-medium tracking-tight">
              Three kinds of answer, not one tip.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-white/50">
            These cards show the layout the agent will fill. They are not live
            recommendations, and they do not promise a return.
          </p>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {BASKETS.map((basket, index) => (
            <article
              key={basket.name}
              className={
                index === 1
                  ? "rounded-[28px] bg-gradient-to-b from-[#d9d0ff] to-[#7c5cff] p-6 text-[#1b1036]"
                  : "app-card rounded-[28px] p-6"
              }
            >
              <p
                className={
                  index === 1
                    ? "text-xs uppercase tracking-[0.16em] text-[#2a1458]/70"
                    : "text-xs uppercase tracking-[0.16em] text-violet-200/70"
                }
              >
                {basket.tone}
              </p>
              <h3 className="mt-5 font-serif text-4xl italic">{basket.name}</h3>
              <p
                className={
                  index === 1
                    ? "mt-4 text-sm leading-relaxed text-[#241447]/80"
                    : "mt-4 text-sm leading-relaxed text-white/60"
                }
              >
                {basket.note}
              </p>
              <p
                className={
                  index === 1
                    ? "mt-8 text-xs text-[#2a1458]/60"
                    : "mt-8 text-xs text-white/40"
                }
              >
                Weights appear only after the engine runs on fresh data.
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="drawdown" className="mx-auto max-w-7xl px-5 py-24 md:px-8">
        <div className="app-card overflow-hidden rounded-[32px]">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="border-b border-white/10 p-8 lg:border-r lg:border-b-0 md:p-10">
              <ShieldAlert className="size-6 text-violet-200" />
              <h2 className="mt-6 text-4xl font-medium tracking-tight">
                When the market falls
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-white/60">
                A basket of stocks can lose value, including overnight, when
                the underlying Nasdaq session is closed and the token still
                trades. Hyperdrive does not describe that as protected.
              </p>
            </div>
            <div className="grid sm:grid-cols-3">
              {[
                {
                  icon: Wallet,
                  title: "The loss stays on the card",
                  body: "The dashboard is meant to show the basket you funded, including a negative move.",
                },
                {
                  icon: Waypoints,
                  title: "No silent swap",
                  body: "A drop does not authorize the agent to exit into a different basket.",
                },
                {
                  icon: Sparkles,
                  title: "A calmer basket is a new choice",
                  body: "You can review another suggestion later. It replaces nothing until you approve it.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="border-b border-white/10 p-6 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0"
                >
                  <item.icon className="size-4 text-violet-200" />
                  <h3 className="mt-4 text-base font-medium">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-5 pb-24 md:px-8">
        <h2 className="text-4xl font-medium tracking-tight">Questions</h2>
        <div className="mt-8 divide-y divide-white/10 border-y border-white/10">
          {QUESTIONS.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="cursor-pointer list-none text-lg font-medium marker:content-none">
                <span className="flex items-center justify-between gap-4">
                  {item.q}
                  <span className="text-violet-200 transition group-open:rotate-45">
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section className="px-5 pb-24 md:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[32px] bg-gradient-to-br from-[#8b6cff] via-[#6d28d9] to-[#2e1065] px-8 py-14 md:px-14">
          <p className="text-xs uppercase tracking-[0.18em] text-white/70">
            Open the desk
          </p>
          <h2 className="mt-3 max-w-xl text-4xl font-medium tracking-tight sm:text-5xl">
            Markets are ready. Baskets come next.
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/75">
            Launch the application to connect MetaMask. The dashboard is the
            home for baskets. The markets page is the Nasdaq xStock list on
            Monad.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-12 items-center rounded-full bg-white px-5 text-sm font-semibold text-[#2a1458]"
            >
              Launch application
            </Link>
            <Link
              href="/markets"
              className="inline-flex h-12 items-center rounded-full border border-white/25 px-5 text-sm font-medium text-white"
            >
              Browse markets
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-5 py-12 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Wordmark />
            <p className="mt-4 text-sm leading-relaxed text-white/45">
              Hyperdrive is an investment-intelligence interface for tokenized
              Nasdaq names on Monad. It is not a broker, not custody, and not
              advice. Quoted prices are not expected returns.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 text-sm">
            <div className="flex flex-col gap-2 text-white/60">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                Product
              </p>
              <Link href="/dashboard" className="hover:text-white">
                Dashboard
              </Link>
              <Link href="/markets" className="hover:text-white">
                Markets
              </Link>
              <Link href="/#how" className="hover:text-white">
                How it works
              </Link>
            </div>
            <div className="flex flex-col gap-2 text-white/60">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                Sources
              </p>
              <a
                href="https://docs.xstocks.fi"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white"
              >
                xStocks docs
              </a>
              <a
                href="https://docs.monad.xyz"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white"
              >
                Monad docs
              </a>
              <a
                href="https://monadscan.com"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white"
              >
                Monadscan
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Wave() {
  return (
    <svg viewBox="0 0 140 48" className="h-12 w-28" aria-hidden>
      <path
        d="M2 34c16 0 18-18 34-16s18 20 34 16 20-22 36-16 18 18 32 10"
        fill="none"
        stroke="#2a1458"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  );
}
