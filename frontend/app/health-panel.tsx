import { fetchHealth } from "@/lib/api";

export async function HealthPanel() {
  let health: Awaited<ReturnType<typeof fetchHealth>> | null = null;
  let message: string | null = null;

  try {
    health = await fetchHealth();
  } catch (error) {
    message = error instanceof Error ? error.message : "Backend unreachable";
  }

  if (!health) {
    return (
      <p className="mt-3 text-sm text-amber-400">
        {message ?? "Backend unreachable"} — start the backend with{" "}
        <code className="text-zinc-300">npm run dev:backend</code>
      </p>
    );
  }

  return (
    <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-950 p-4 text-xs text-emerald-400">
      {JSON.stringify(health, null, 2)}
    </pre>
  );
}
