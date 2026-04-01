"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Product, CreateProductInput, UpdateProductInput } from "@/types";

interface ProductFormProps {
  mode: "create" | "edit";
  initialData?: Product;
  onSubmit: (data: CreateProductInput | UpdateProductInput) => Promise<void>;
}

interface FormErrors {
  name?: string;
  price?: string;
  reorderLevel?: string;
  initialStock?: string;
}

export function ProductForm({ mode, initialData, onSubmit }: ProductFormProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(
    initialData?.description ?? ""
  );
  const [category, setCategory] = useState(initialData?.category ?? "");
  const [price, setPrice] = useState(
    initialData ? parseFloat(initialData.price).toString() : ""
  );
  const [reorderLevel, setReorderLevel] = useState(
    initialData?.reorderLevel?.toString() ?? "10"
  );
  const [initialStock, setInitialStock] = useState("0");

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    // Name: required
    if (!name.trim()) {
      newErrors.name = "Product name is required";
    }

    // Price: required, > 0
    const priceNum = parseFloat(price);
    if (!price.trim() || isNaN(priceNum)) {
      newErrors.price = "Price is required";
    } else if (priceNum <= 0) {
      newErrors.price = "Price must be greater than zero";
    }

    // Reorder level: optional but if set must be non-negative integer
    if (reorderLevel.trim()) {
      const level = parseInt(reorderLevel, 10);
      if (isNaN(level) || level < 0) {
        newErrors.reorderLevel = "Reorder level must be 0 or greater";
      }
    }

    // Initial stock: only in create mode, must be non-negative integer
    if (mode === "create" && initialStock.trim()) {
      const stock = parseInt(initialStock, 10);
      if (isNaN(stock) || stock < 0) {
        newErrors.initialStock = "Initial stock must be 0 or greater";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [mode, name, price, reorderLevel, initialStock]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (isSubmitting) return;
      if (!validate()) return;

      setIsSubmitting(true);
      setSubmitError(null);

      try {
        if (mode === "create") {
          const data: CreateProductInput = {
            name: name.trim(),
            price: parseFloat(price),
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(category.trim() ? { category: category.trim() } : {}),
            ...(reorderLevel.trim()
              ? { reorderLevel: parseInt(reorderLevel, 10) }
              : {}),
            ...(initialStock.trim() && parseInt(initialStock, 10) > 0
              ? { initialStock: parseInt(initialStock, 10) }
              : {}),
          };
          await onSubmit(data);
        } else {
          const data: UpdateProductInput = {
            name: name.trim(),
            price: parseFloat(price),
            ...(description.trim()
              ? { description: description.trim() }
              : { description: undefined }),
            ...(category.trim()
              ? { category: category.trim() }
              : { category: undefined }),
            ...(reorderLevel.trim()
              ? { reorderLevel: parseInt(reorderLevel, 10) }
              : {}),
          };
          await onSubmit(data);
        }
      } catch (err) {
        setSubmitError(
          err instanceof Error ? err.message : "Something went wrong"
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      category,
      description,
      initialStock,
      isSubmitting,
      mode,
      name,
      onSubmit,
      price,
      reorderLevel,
      validate,
    ]
  );

  const inputClasses = cn(
    "w-full rounded-xl bg-slate-50 px-4 py-3.5 text-base text-slate-700",
    "outline-none transition-colors",
    "hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
  );

  const labelClasses =
    "block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2";

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Name */}
      <div>
        <label htmlFor="name" className={labelClasses}>
          Product Name <span className="text-red-400">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Ergonomic Drafting Stool"
          className={cn(
            inputClasses,
            errors.name && "ring-2 ring-red-300 focus:ring-red-400"
          )}
        />
        {errors.name && (
          <p className="mt-2 text-sm text-red-500">{errors.name}</p>
        )}
      </div>

      {/* SKU info (create mode only) */}
      {mode === "create" && (
        <div className="flex items-start gap-3 rounded-xl bg-indigo-50 p-4">
          <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <p className="text-sm text-indigo-700">
            SKU will be <strong>auto-generated</strong> from the category or product name (e.g., ELE-001, STA-002).
          </p>
        </div>
      )}

      {/* SKU display (edit mode only) */}
      {mode === "edit" && initialData && (
        <div>
          <label className={labelClasses}>SKU</label>
          <div className={cn(inputClasses, "cursor-not-allowed opacity-60 font-mono")}>
            {initialData.sku}
          </div>
        </div>
      )}

      {/* Description */}
      <div>
        <label htmlFor="description" className={labelClasses}>
          Description{" "}
          <span className="font-normal normal-case tracking-normal text-slate-300">
            (optional)
          </span>
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Detailed product specifications, materials, and features..."
          rows={4}
          className={cn(inputClasses, "resize-none")}
        />
      </div>

      {/* Category */}
      <div>
        <label htmlFor="category" className={labelClasses}>
          Category{" "}
          <span className="font-normal normal-case tracking-normal text-slate-300">
            (optional)
          </span>
        </label>
        <input
          id="category"
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g., Office Supplies"
          className={inputClasses}
        />
        {mode === "create" && category.trim().length >= 3 && (
          <p className="mt-2 text-sm text-slate-400">
            SKU prefix:{" "}
            <span className="font-mono text-slate-600 font-semibold">
              {category.trim().substring(0, 3).toUpperCase()}-
            </span>
          </p>
        )}
      </div>

      {/* Price, Reorder Level, and Initial Stock */}
      <div className={cn("grid gap-5", mode === "create" ? "grid-cols-3" : "grid-cols-2")}>
        <div>
          <label htmlFor="price" className={labelClasses}>
            Unit Price (USD) <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-slate-400">$</span>
            <input
              id="price"
              type="number"
              step="0.01"
              min="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className={cn(
                inputClasses,
                "pl-8",
                errors.price && "ring-2 ring-red-300 focus:ring-red-400"
              )}
            />
          </div>
          {errors.price && (
            <p className="mt-2 text-sm text-red-500">{errors.price}</p>
          )}
        </div>

        <div>
          <label htmlFor="reorderLevel" className={labelClasses}>
            Reorder Level
          </label>
          <input
            id="reorderLevel"
            type="number"
            min="0"
            step="1"
            value={reorderLevel}
            onChange={(e) => setReorderLevel(e.target.value)}
            placeholder="10"
            className={cn(
              inputClasses,
              errors.reorderLevel && "ring-2 ring-red-300 focus:ring-red-400"
            )}
          />
          <p className="mt-2 text-sm text-slate-400 italic">
            Alert when stock falls below this.
          </p>
          {errors.reorderLevel && (
            <p className="mt-1 text-sm text-red-500">{errors.reorderLevel}</p>
          )}
        </div>

        {/* Initial Stock — create mode only */}
        {mode === "create" && (
          <div>
            <label htmlFor="initialStock" className={labelClasses}>
              Initial Stock
            </label>
            <input
              id="initialStock"
              type="number"
              min="0"
              step="1"
              value={initialStock}
              onChange={(e) => setInitialStock(e.target.value)}
              placeholder="0"
              className={cn(
                inputClasses,
                errors.initialStock && "ring-2 ring-red-300 focus:ring-red-400"
              )}
            />
            <p className="mt-2 text-sm text-slate-400 italic">
              Opening stock quantity.
            </p>
            {errors.initialStock && (
              <p className="mt-1 text-sm text-red-500">{errors.initialStock}</p>
            )}
          </div>
        )}
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="rounded-xl bg-red-50 p-4">
          <p className="text-base text-red-600">{submitError}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-2">
        <Link
          href="/products"
          className={cn(
            "rounded-xl px-6 py-3 text-[15px] font-medium text-slate-600",
            "transition-colors hover:bg-slate-100"
          )}
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 px-8 py-3",
            "text-[15px] font-medium text-white",
            "transition-all hover:shadow-lg hover:shadow-indigo-200",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
          )}
        >
          {isSubmitting
            ? mode === "create"
              ? "Creating..."
              : "Saving..."
            : mode === "create"
              ? "Create Product"
              : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
