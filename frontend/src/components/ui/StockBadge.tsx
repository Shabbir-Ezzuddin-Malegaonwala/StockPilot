"use client";

import { cn } from "@/lib/utils";
import { getStockStatus } from "@/lib/utils";

interface StockBadgeProps {
  currentStock: number;
  reorderLevel: number;
}

export function StockBadge({ currentStock, reorderLevel }: StockBadgeProps) {
  const status = getStockStatus(currentStock, reorderLevel);

  const config = {
    "in-stock": {
      label: "In Stock",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      dot: "bg-emerald-500",
    },
    "low-stock": {
      label: "Low Stock",
      bg: "bg-amber-50",
      text: "text-amber-700",
      dot: "bg-amber-500",
    },
    "out-of-stock": {
      label: "Out of Stock",
      bg: "bg-red-50",
      text: "text-red-700",
      dot: "bg-red-500",
    },
  };

  const { label, bg, text, dot } = config[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide",
        bg,
        text
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      {label}
    </span>
  );
}
