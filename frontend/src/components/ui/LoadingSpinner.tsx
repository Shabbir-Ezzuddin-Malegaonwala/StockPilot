"use client";

import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  message?: string;
}

export function LoadingSpinner({ size = "md", message }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-5 w-5 border-2",
    md: "h-10 w-10 border-[3px]",
    lg: "h-14 w-14 border-[3px]",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div
        className={cn(
          "animate-spin rounded-full border-indigo-600 border-t-transparent",
          sizeClasses[size]
        )}
      />
      {message && (
        <p className="text-base text-slate-500">{message}</p>
      )}
    </div>
  );
}
