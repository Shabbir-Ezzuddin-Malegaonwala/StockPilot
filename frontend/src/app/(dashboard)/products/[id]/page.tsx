"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useInventoryStore } from "@/store/inventory.store";
import { useAuthStore } from "@/store/auth.store";
import { cn, formatPrice, formatDate, formatDateTime, getStockStatus } from "@/lib/utils";
import { StockBadge } from "@/components/ui/StockBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { MovementBadge } from "@/components/ui/MovementBadge";
import { StockAdjustModal } from "@/components/products/StockAdjustModal";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const {
    selectedProduct,
    movements,
    isLoading,
    isSubmitting,
    error,
    fetchProduct,
    deleteProduct,
    analyzeProduct,
  } = useInventoryStore();

  const { hasRole } = useAuthStore();
  const canEdit = hasRole("manager");
  const canDelete = hasRole("admin");

  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProduct(id);
    }
  }, [id, fetchProduct]);

  const handleDelete = useCallback(async () => {
    if (!id) return;
    try {
      await deleteProduct(id);
      router.push("/dashboard");
    } catch {
      // Error is handled by the store
    }
  }, [id, deleteProduct, router]);

  const handleAnalyze = useCallback(async () => {
    if (!id) return;
    await analyzeProduct(id);
  }, [id, analyzeProduct]);

  // Loading state
  if (isLoading) {
    return <LoadingSpinner size="lg" message="Loading product details..." />;
  }

  // Error state
  if (error) {
    return <ErrorState message={error} onRetry={() => id && fetchProduct(id)} />;
  }

  // No product loaded
  if (!selectedProduct) {
    return <LoadingSpinner size="lg" message="Loading..." />;
  }

  const product = selectedProduct;
  const stockStatus = getStockStatus(product.currentStock, product.reorderLevel);
  const stockPercent = product.reorderLevel > 0
    ? Math.min(100, Math.round((product.currentStock / (product.reorderLevel * 2)) * 100))
    : product.currentStock > 0 ? 100 : 0;

  const stockBarColor =
    stockStatus === "out-of-stock"
      ? "bg-red-500"
      : stockStatus === "low-stock"
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-[15px]">
        <Link
          href="/products"
          className="font-medium text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-wide text-xs"
        >
          Products
        </Link>
        <svg
          className="h-4 w-4 text-slate-300"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m8.25 4.5 7.5 7.5-7.5 7.5"
          />
        </svg>
        <span className="font-semibold text-slate-700 uppercase tracking-wide text-xs">Details</span>
      </nav>

      {/* Product header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900">
              {product.name}
            </h1>
            <StatusBadge status={product.status} />
          </div>
          <p className="mt-2 text-base font-mono text-slate-500">
            SKU: {product.sku}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAdjustModal(true)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-5 py-3",
              "border border-slate-200 bg-white text-[15px] font-medium text-slate-700",
              "transition-all hover:bg-slate-50"
            )}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
            </svg>
            Adjust Stock
          </button>
          <button
            onClick={handleAnalyze}
            disabled={isSubmitting}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-5 py-3",
              "bg-gradient-to-br from-[#3525cd] to-[#4f46e5]",
              "text-[15px] font-medium text-white",
              "transition-all hover:shadow-lg hover:shadow-indigo-200",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
            {isSubmitting ? "Analyzing..." : "Analyze with AI"}
          </button>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 mb-8">
        {/* Left column — Product Specs (3 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-6">
              Specifications
            </h2>
            <dl className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Category</dt>
                  <dd className="text-[15px] font-medium text-slate-900">
                    {product.category || "\u2014"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Price</dt>
                  <dd className="text-[15px] font-medium text-slate-900">
                    {formatPrice(product.price)} / unit
                  </dd>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Reorder Level</dt>
                  <dd className="text-[15px] font-medium text-indigo-600">
                    {product.reorderLevel} units
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Created</dt>
                  <dd className="text-[15px] text-slate-700">
                    {formatDate(product.createdAt)}
                  </dd>
                </div>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Description</dt>
                <dd className="text-[15px] text-slate-700 leading-relaxed">
                  {product.description || "No description provided."}
                </dd>
              </div>
            </dl>
          </div>

          {/* Actions — role-conditional */}
          {(canEdit || canDelete) && (
            <div className="flex items-center gap-3">
              {canEdit && (
                <Link
                  href={`/products/${id}/edit`}
                  className={cn(
                    "rounded-xl px-5 py-3 text-[15px] font-medium",
                    "text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                  )}
                >
                  Edit Product
                </Link>
              )}
              {canDelete && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className={cn(
                    "rounded-xl px-5 py-3 text-[15px] font-medium",
                    "text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                  )}
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right column — Stock + AI (2 cols) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Current Stock card */}
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
              Current Inventory
            </p>
            <div className="flex items-end justify-between mb-4">
              <p className="text-5xl font-bold text-slate-900">
                {product.currentStock}
                <span className="ml-2 text-lg font-normal text-slate-400">
                  units
                </span>
              </p>
              <StockBadge
                currentStock={product.currentStock}
                reorderLevel={product.reorderLevel}
              />
            </div>

            {/* Stock progress bar */}
            <div className="mb-2">
              <div className="h-3 w-full rounded-full bg-slate-100">
                <div
                  className={cn(
                    "h-3 rounded-full transition-all duration-500",
                    stockBarColor
                  )}
                  style={{ width: `${stockPercent}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {stockPercent > 100 ? "Above" : Math.round(((product.currentStock - product.reorderLevel) / product.reorderLevel) * 100)}% {product.currentStock >= product.reorderLevel ? "above" : "below"} reorder threshold ({product.reorderLevel})
              </p>
            </div>
          </div>

          {/* AI Recommendation card */}
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">AI Smart Stock Recommendation</h3>
              </div>
              {product.aiRecommendation && (
                <span className={cn(
                  "ml-auto rounded-lg px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                  product.aiRecommendation.includes("urgent") ? "bg-red-50 text-red-700" :
                  product.aiRecommendation.includes("soon") ? "bg-amber-50 text-amber-700" :
                  product.aiRecommendation.includes("overstocked") ? "bg-blue-50 text-blue-700" :
                  "bg-emerald-50 text-emerald-700"
                )}>
                  {product.aiRecommendation.replace(/_/g, " ")}
                </span>
              )}
            </div>

            {product.aiReasoning ? (
              <p className="text-[15px] text-slate-600 leading-relaxed">
                {product.aiReasoning}
              </p>
            ) : (
              <p className="text-[15px] text-slate-400">
                No AI analysis yet. Click &ldquo;Analyze with AI&rdquo; above to generate a recommendation.
              </p>
            )}

            {product.aiAnalyzedAt && (
              <p className="mt-3 text-sm text-slate-400">
                Last analyzed: {formatDateTime(product.aiAnalyzedAt)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stock Movement History */}
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900">
            Stock Movement History
          </h2>
          <button className="text-[15px] font-medium text-indigo-600 hover:text-indigo-700">
            Export CSV
          </button>
        </div>

        {movements.length === 0 ? (
          <p className="text-base text-slate-400 py-8 text-center">
            No stock movements recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Date
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Type
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Qty
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Reason
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Before
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                    After
                  </th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => {
                  const isSubtraction =
                    movement.movementType === "sold" ||
                    movement.movementType === "damaged";
                  return (
                    <tr
                      key={movement.id}
                      className="border-b border-slate-50 transition-colors hover:bg-slate-50/50"
                    >
                      <td className="px-4 py-4 text-[15px] text-slate-600">
                        {formatDateTime(movement.createdAt)}
                      </td>
                      <td className="px-4 py-4">
                        <MovementBadge type={movement.movementType} />
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            "text-[15px] font-semibold",
                            isSubtraction ? "text-red-600" : "text-emerald-600"
                          )}
                        >
                          {isSubtraction ? "-" : "+"}
                          {Math.abs(movement.quantity)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-[15px] text-slate-600">
                        {movement.reason || "\u2014"}
                      </td>
                      <td className="px-4 py-4 text-[15px] text-slate-600">
                        {movement.stockBefore}
                      </td>
                      <td className="px-4 py-4 text-[15px] font-semibold text-slate-900">
                        {movement.stockAfter}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stock Adjust Modal */}
      <StockAdjustModal
        productId={id}
        productName={product.name}
        currentStock={product.currentStock}
        isOpen={showAdjustModal}
        onClose={() => {
          setShowAdjustModal(false);
          // Refresh product data after adjustment
          fetchProduct(id);
        }}
      />

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
            <h3 className="text-xl font-semibold text-slate-900">
              Delete Product
            </h3>
            <p className="mt-3 text-base text-slate-600">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{product.name}</span>? This will
              mark the product as discontinued.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-xl px-5 py-3 text-[15px] font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isSubmitting}
                className={cn(
                  "rounded-xl bg-red-600 px-5 py-3 text-[15px] font-medium text-white",
                  "transition-colors hover:bg-red-700",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                {isSubmitting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
