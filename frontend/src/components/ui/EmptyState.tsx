"use client";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      {/* Empty box icon */}
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100">
        <svg
          className="h-10 w-10 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"
          />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-base text-slate-500 text-center max-w-md">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className={cn(
            "mt-6 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 px-6 py-3",
            "text-[15px] font-medium text-white transition-all hover:shadow-lg hover:shadow-indigo-200"
          )}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
