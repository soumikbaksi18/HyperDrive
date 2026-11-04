import { fetchHealth } from "@/lib/api";

export async function HealthPanel() {
  try {
    const health = await fetchHealth();
    return (
      <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-950 p-4 text-xs text-emerald-400">
        {JSON.stringify(health, null, 2)}
      </pre>
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Backend unreachable";
    return (
      <p className="mt-3 text-sm text-amber-400">
        {message} — start the backend with{" "}
        <code className="text-zinc-300">npm run dev:backend</code>
      </p>
    );
  }
}
