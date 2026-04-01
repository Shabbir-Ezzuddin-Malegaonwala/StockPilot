"use client";

import Link from "next/link";
import { useInventoryStore } from "@/store/inventory.store";
import { cn, formatPrice } from "@/lib/utils";
import { StockBadge } from "@/components/ui/StockBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";

export function ProductList() {
  const {
    products,
    isLoading,
    error,
    currentPage,
    totalPages,
    total,
    fetchProducts,
    setPage,
  } = useInventoryStore();

  // Loading state
  if (isLoading) {
    return <LoadingSpinner size="lg" message="Loading products..." />;
  }

  // Error state
  if (error) {
    return <ErrorState message={error} onRetry={fetchProducts} />;
  }

  // Empty state
  if (products.length === 0) {
    return (
      <EmptyState
        title="No products found"
        description="There are no products matching your current filters. Try adjusting your search or create a new product."
      />
    );
  }

  // Build page numbers for pagination
  const getPageNumbers = (): (number | "ellipsis")[] => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("ellipsis");

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);

      if (currentPage < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }

    return pages;
  };

  const columnHeaderClasses = cn(
    "px-5 py-4 text-left text-xs font-semibold uppercase tracking-widest text-slate-400"
  );

  return (
    <div>
      {/* Results count */}
      <p className="mb-4 text-[15px] text-slate-500">
        Showing <span className="font-semibold text-slate-700">1-{Math.min(products.length, 20)}</span> of{" "}
        <span className="font-semibold text-slate-700">{total.toLocaleString()}</span> products
      </p>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className={columnHeaderClasses}>Name</th>
              <th className={columnHeaderClasses}>SKU</th>
              <th className={columnHeaderClasses}>Category</th>
              <th className={columnHeaderClasses}>Price</th>
              <th className={columnHeaderClasses}>Stock</th>
              <th className={columnHeaderClasses}>Status</th>
              <th className={cn(columnHeaderClasses, "text-right")}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr
                key={product.id}
                className="border-b border-slate-50 transition-colors hover:bg-slate-50/50"
              >
                <td className="px-5 py-4">
                  <span className="text-[15px] font-medium text-slate-900">
                    {product.name}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className="text-[15px] font-mono text-slate-600">
                    {product.sku}
                  </span>
                </td>
                <td className="px-5 py-4">
                  {product.category ? (
                    <span className="inline-flex rounded-lg bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                      {product.category}
                    </span>
                  ) : (
                    <span className="text-[15px] text-slate-400">&mdash;</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <span className="text-[15px] font-medium text-slate-900">
                    {formatPrice(product.price)}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[15px] font-semibold text-slate-900">
                      {product.currentStock}
                    </span>
                    <StockBadge
                      currentStock={product.currentStock}
                      reorderLevel={product.reorderLevel}
                    />
                  </div>
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={product.status} />
                </td>
                <td className="px-5 py-4 text-right">
                  <Link
                    href={`/products/${product.id}`}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-xl px-4 py-2",
                      "bg-slate-100 text-sm font-medium text-slate-700",
                      "transition-all hover:bg-slate-200"
                    )}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-[15px] text-slate-500">
            Page {currentPage} of {totalPages}
          </p>

          <div className="flex items-center gap-1.5">
            {/* Previous */}
            <button
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl text-sm transition-colors",
                currentPage === 1
                  ? "cursor-not-allowed text-slate-300"
                  : "text-slate-600 hover:bg-slate-100"
              )}
              aria-label="Previous page"
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
                  d="M15.75 19.5 8.25 12l7.5-7.5"
                />
              </svg>
            </button>

            {/* Page numbers */}
            {getPageNumbers().map((page, idx) =>
              page === "ellipsis" ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="flex h-10 w-10 items-center justify-center text-[15px] text-slate-400"
                >
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => setPage(page)}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl text-[15px] font-medium transition-colors",
                    page === currentPage
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {page}
                </button>
              )
            )}

            {/* Next */}
            <button
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl text-sm transition-colors",
                currentPage === totalPages
                  ? "cursor-not-allowed text-slate-300"
                  : "text-slate-600 hover:bg-slate-100"
              )}
              aria-label="Next page"
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
                  d="m8.25 4.5 7.5 7.5-7.5 7.5"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
