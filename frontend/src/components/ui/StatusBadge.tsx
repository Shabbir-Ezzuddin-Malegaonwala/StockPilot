"use client";

import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "active" | "discontinued";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide",
        status === "active"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500"
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          status === "active" ? "bg-emerald-500" : "bg-slate-400"
        )}
      />
      {status === "active" ? "Active" : "Discontinued"}
    </span>
  );
}
