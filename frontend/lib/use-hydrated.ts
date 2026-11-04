import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False during SSR/prerender and the hydration pass, true afterwards. Gate wallet-dependent UI on it to avoid hydration mismatches. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
