"use client";

import { useState, useEffect, useCallback } from "react";
import { useInventoryStore } from "@/store/inventory.store";
import { cn } from "@/lib/utils";
import type { StockAdjustInput } from "@/types";

interface StockAdjustModalProps {
  productId: string;
  productName: string;
  currentStock: number;
  isOpen: boolean;
  onClose: () => void;
}

const MOVEMENT_TYPES = [
  { value: "received", label: "Received" },
  { value: "sold", label: "Sold" },
  { value: "returned", label: "Returned" },
  { value: "adjustment", label: "Adjustment" },
  { value: "damaged", label: "Damaged" },
] as const;

export function StockAdjustModal({
  productId,
  productName,
  currentStock,
  isOpen,
  onClose,
}: StockAdjustModalProps) {
  const { adjustStock } = useInventoryStore();

  const [quantity, setQuantity] = useState<number>(0);
  const [movementType, setMovementType] =
    useState<StockAdjustInput["movementType"]>("received");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuantity(0);
      setMovementType("received");
      setReason("");
      setSubmitError(null);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Calculate projected stock
  const isSubtraction =
    movementType === "sold" || movementType === "damaged";
  const projectedStock = isSubtraction
    ? currentStock - Math.abs(quantity)
    : currentStock + Math.abs(quantity);
  const wouldGoNegative = projectedStock < 0 && quantity !== 0;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (isSubmitting || quantity === 0) return;

      setIsSubmitting(true);
      setSubmitError(null);

      try {
        const isSubtractionType = movementType === "sold" || movementType === "damaged";
        const data: StockAdjustInput = {
          quantity: isSubtractionType ? -Math.abs(quantity) : Math.abs(quantity),
          movementType,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        };
        await adjustStock(productId, data);
        onClose();
      } catch (err) {
        setSubmitError(
          err instanceof Error ? err.message : "Failed to adjust stock"
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [adjustStock, isSubmitting, movementType, onClose, productId, quantity, reason]
  );

  if (!isOpen) return null;

  const inputClasses = cn(
    "w-full rounded-xl bg-slate-50 px-4 py-3.5 text-base text-slate-700",
    "outline-none transition-colors",
    "hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
  );

  const labelClasses =
    "block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Adjust stock"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className={cn(
            "absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-xl",
            "text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          )}
          aria-label="Close"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18 18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Header */}
        <h2 className="text-2xl font-semibold text-slate-900">Stock Adjustment</h2>
        <p className="mt-2 text-base text-slate-500">
          Refining stock levels for{" "}
          <Link className="font-semibold text-indigo-600">{productName}</Link>
        </p>

        {/* Negative stock warning */}
        {wouldGoNegative && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border-l-4 border-red-400 bg-red-50 p-4">
            <svg
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
            <p className="text-sm font-medium text-red-700">
              Warning: Quantity would make stock negative.
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="grid grid-cols-2 gap-5">
            {/* Quantity */}
            <div>
              <label htmlFor="quantity" className={labelClasses}>
                Quantity
              </label>
              <input
                id="quantity"
                type="number"
                value={quantity || ""}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
                placeholder="15"
                className={inputClasses}
                required
              />
              <p className="mt-1.5 text-xs text-slate-400 italic">
                Select movement type to add or remove stock
              </p>
            </div>

            {/* Movement Type */}
            <div>
              <label htmlFor="movementType" className={labelClasses}>
                Movement Type
              </label>
              <div className="relative">
                <select
                  id="movementType"
                  value={movementType}
                  onChange={(e) =>
                    setMovementType(
                      e.target.value as StockAdjustInput["movementType"]
                    )
                  }
                  className={cn(inputClasses, "appearance-none cursor-pointer pr-10")}
                >
                  {MOVEMENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <svg
                  className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m19.5 8.25-7.5 7.5-7.5-7.5"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label htmlFor="reason" className={labelClasses}>
              Reason{" "}
              <span className="font-normal normal-case tracking-normal text-slate-300">
                (optional)
              </span>
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this adjustment is being made..."
              rows={3}
              className={cn(inputClasses, "resize-none")}
            />
          </div>

          {/* Submit error */}
          {submitError && (
            <p className="text-base text-red-600">{submitError}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={cn(
                "rounded-xl px-6 py-3 text-[15px] font-medium text-slate-600",
                "transition-colors hover:bg-slate-100",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || quantity === 0}
              className={cn(
                "rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 px-6 py-3",
                "text-[15px] font-medium text-white",
                "transition-all hover:shadow-lg hover:shadow-indigo-200",
                "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
              )}
            >
              {isSubmitting ? "Adjusting..." : "Confirm Adjustment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Link({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={className}>{children}</span>;
}
