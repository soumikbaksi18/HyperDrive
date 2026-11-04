"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  Building2,
  Check,
  ChevronDown,
  Cpu,
  Gem,
  Globe2,
  HeartPulse,
  Landmark,
  Layers,
  LayoutGrid,
  ShoppingBag,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  EXCHANGE_GROUPS,
  exchangeCounts,
  nasdaqCatalog,
  SECTORS,
  sectorCounts,
  type ExchangeGroup,
  type Sector,
} from "@/lib/xstocks";

const ICONS: Record<Sector, LucideIcon> = {
  Tech: Cpu,
  AI: Sparkles,
  Healthcare: HeartPulse,
  Energy: Zap,
  Financial: Landmark,
  "Real Estate": Building2,
  Commodities: Gem,
  Consumer: ShoppingBag,
  Other: Layers,
};

type Option<T extends string> = { value: T | null; label: string; count: number; Icon: LucideIcon };

const SECTOR_OPTIONS: Option<Sector>[] = [
  { value: null, label: "All sectors", count: nasdaqCatalog.count, Icon: LayoutGrid },
  ...SECTORS.map((sector) => ({ value: sector, label: sector, count: sectorCounts[sector], Icon: ICONS[sector] })),
];

const EXCHANGE_OPTIONS: Option<ExchangeGroup>[] = [
  { value: null, label: "All exchanges", count: nasdaqCatalog.count, Icon: Globe2 },
  ...EXCHANGE_GROUPS.map((group) => ({ value: group, label: group, count: exchangeCounts[group], Icon: Landmark })),
];

type FilterProps<T extends string> = {
  value: T | null;
  onChange: (value: T | null) => void;
  className?: string;
};

export function SectorFilter(props: FilterProps<Sector>) {
  return <FilterDropdown {...props} options={SECTOR_OPTIONS} ariaLabel="Filter by sector" />;
}

export function ExchangeFilter(props: FilterProps<ExchangeGroup>) {
  return <FilterDropdown {...props} options={EXCHANGE_OPTIONS} ariaLabel="Filter by exchange" />;
}

/** Single-select dropdown with an animated panel (CSS transitions, no animation library). */
function FilterDropdown<T extends string>({
  value,
  onChange,
  className,
  options: OPTIONS,
  ariaLabel,
}: FilterProps<T> & { options: Option<T>[]; ariaLabel: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listId = useId();

  const selectedIndex = Math.max(0, OPTIONS.findIndex((option) => option.value === value));
  const selected = OPTIONS[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) optionRefs.current[active]?.focus();
  }, [open, active]);

  const openPanel = () => {
    setActive(selectedIndex);
    setOpen(true);
  };

  const choose = (option: Option<T>) => {
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openPanel();
    }
  };

  const onListKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % OPTIONS.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + OPTIONS.length) % OPTIONS.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(OPTIONS.length - 1);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  const SelectedIcon = selected.Icon;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? setOpen(false) : openPanel())}
        onKeyDown={onTriggerKey}
        className={cn(
          "flex h-11 w-full items-center gap-2 rounded-full border bg-white/[0.03] pr-3 pl-4 text-sm transition-colors md:w-auto",
          open || value ? "border-violet-300/40 text-white" : "border-white/10 text-white/75 hover:border-white/20 hover:text-white",
        )}
      >
        <SelectedIcon className={cn("size-4 shrink-0", value ? "text-violet-200" : "text-white/50")} />
        <span className="min-w-0 flex-1 truncate text-left">{selected.label}</span>
        <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] text-white/55 tabular-nums">
          {selected.count}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-white/45 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      <div
        id={listId}
        role="listbox"
        aria-label={ariaLabel}
        aria-hidden={!open}
        onKeyDown={onListKey}
        className={cn(
          "absolute right-0 z-40 mt-2 w-full origin-top-right rounded-2xl border border-white/10 bg-[#160c28]/95 p-1.5 shadow-2xl shadow-black/40 backdrop-blur-xl md:w-64",
          "transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none",
          open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-95 opacity-0",
        )}
      >
        {OPTIONS.map((option, index) => {
          const isSelected = option.value === value;
          const Icon = option.Icon;
          return (
            <button
              key={option.label}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              type="button"
              role="option"
              aria-selected={isSelected}
              tabIndex={open && index === active ? 0 : -1}
              onClick={() => choose(option)}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm outline-none transition-colors",
                index === active ? "bg-white/[0.07] text-white" : "text-white/70",
                index === 0 && "mb-1",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-lg",
                  isSelected ? "bg-violet-400/20 text-violet-100" : "bg-white/[0.05] text-white/55",
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <span className="flex-1">{option.label}</span>
              <span className="text-xs text-white/35 tabular-nums">{option.count}</span>
              <Check className={cn("size-3.5 text-violet-200 transition-opacity", isSelected ? "opacity-100" : "opacity-0")} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
