import { Suspense } from "react";
import { HealthPanel } from "./health-panel";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
        <header className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-widest text-violet-400">
            Hyperdrive
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">
            Monad Stock Intelligence
          </h1>
          <p className="text-lg text-zinc-400">
            Monorepo scaffold: Next.js frontend, NestJS API, and Solidity
            contracts for Monad.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "frontend",
              stack: "Next.js · TypeScript · Tailwind",
              port: "3000",
            },
            {
              title: "backend",
              stack: "NestJS · TypeScript",
              port: "3001 · /api",
            },
            {
              title: "contracts",
              stack: "Solidity · Hardhat 3 · Monad",
              port: "compile / deploy",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
            >
              <h2 className="font-mono text-sm text-violet-300">{item.title}</h2>
              <p className="mt-2 text-sm text-zinc-400">{item.stack}</p>
              <p className="mt-3 text-xs text-zinc-500">{item.port}</p>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="text-sm font-medium text-zinc-300">API health</h2>
          <Suspense
            fallback={
              <p className="mt-3 text-sm text-zinc-500">Checking backend…</p>
            }
          >
            <HealthPanel />
          </Suspense>
        </section>
      </main>
    </div>
  );
}
