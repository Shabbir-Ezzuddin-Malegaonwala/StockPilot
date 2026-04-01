"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useInventoryStore } from "@/store/inventory.store";
import { useAuthStore } from "@/store/auth.store";
import { cn } from "@/lib/utils";
import { FilterBar } from "@/components/products/FilterBar";
import { ProductList } from "@/components/products/ProductList";

export default function ProductsPage() {
  const { fetchProducts, fetchCategories } = useInventoryStore();
  const { hasRole } = useAuthStore();
  const canCreateProduct = hasRole("manager");

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [fetchProducts, fetchCategories]);

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Products</h1>
          <p className="mt-1 text-sm sm:text-base text-slate-500">
            Manage your inventory items
          </p>
        </div>
        {canCreateProduct && (
          <Link
            href="/products/new"
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl",
              "bg-gradient-to-br from-[#3525cd] to-[#4f46e5] px-4 sm:px-6 py-2.5 sm:py-3",
              "text-sm sm:text-[15px] font-medium text-white",
              "transition-all hover:shadow-lg hover:shadow-indigo-200",
              "w-full sm:w-auto"
            )}
          >
            <svg
              className="h-4 w-4 sm:h-5 sm:w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            Add Product
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6">
        <FilterBar />
      </div>

      {/* Product list */}
      <ProductList />
    </div>
  );
}
