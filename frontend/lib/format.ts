export function shortAddress(address: string, lead = 6, tail = 4) {
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatMon(amount: string | number) {
  const value = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 1000 ? 2 : 4,
  }).format(value)} MON`;
}

export function formatCatalogDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

export function formatSignedUsd(value: number) {
  const sign = value > 0.004 ? "+" : value < -0.004 ? "−" : "";
  return `${sign}${formatUsd(Math.abs(value))}`;
}

export function formatPct(value: number, signed = true) {
  const sign = signed && value > 0.004 ? "+" : value < -0.004 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

export function formatShares(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 2 : value >= 1 ? 4 : 6,
  }).format(value);
}

export function pnlTone(value: number) {
  if (value > 0.004) return "text-emerald-300";
  if (value < -0.004) return "text-rose-300";
  return "text-white/60";
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
