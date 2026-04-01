"use client";

import { cn } from "@/lib/utils";

interface MovementBadgeProps {
  type: string;
}

const config: Record<string, { label: string; bg: string; text: string }> = {
  received: { label: "Received", bg: "bg-emerald-50", text: "text-emerald-700" },
  sold: { label: "Sold", bg: "bg-blue-50", text: "text-blue-700" },
  returned: { label: "Returned", bg: "bg-amber-50", text: "text-amber-700" },
  adjustment: { label: "Adjustment", bg: "bg-slate-100", text: "text-slate-700" },
  damaged: { label: "Damaged", bg: "bg-red-50", text: "text-red-700" },
};

export function MovementBadge({ type }: MovementBadgeProps) {
  const c = config[type] || { label: type, bg: "bg-slate-100", text: "text-slate-600" };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        c.bg,
        c.text
      )}
    >
      {c.label}
    </span>
  );
}
