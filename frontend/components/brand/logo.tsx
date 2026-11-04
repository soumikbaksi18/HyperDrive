import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="10" fill="#5b21b6" />
      <path
        d="M8.5 9.2 16.2 16 8.5 22.8"
        fill="none"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.2 9.2 22.9 16 15.2 22.8"
        fill="none"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.72"
      />
    </svg>
  );
}

export function Wordmark({
  className,
  markClassName = "size-8",
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="text-[15px] font-semibold tracking-tight text-white">
        Hyperdrive
      </span>
    </span>
  );
}
