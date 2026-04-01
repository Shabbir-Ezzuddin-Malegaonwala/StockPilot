"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useInventoryStore } from "@/store/inventory.store";
import { useAuthStore } from "@/store/auth.store";
import { ProductForm } from "@/components/products/ProductForm";
import type { CreateProductInput, UpdateProductInput } from "@/types";

export default function NewProductPage() {
  const router = useRouter();
  const { createProduct } = useInventoryStore();
  const { hasRole } = useAuthStore();

  // Only managers and above can create products
  if (!hasRole("manager")) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="rounded-2xl bg-white p-8 shadow-sm text-center max-w-md">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-500">
            You need manager privileges or higher to create products.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = useCallback(
    async (data: CreateProductInput | UpdateProductInput) => {
      const product = await createProduct(data as CreateProductInput);
      router.push(`/products/${product.id}`);
    },
    [createProduct, router]
  );

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2">
        <Link
          href="/products"
          className="text-xs font-semibold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
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
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-700">Create New</span>
      </nav>

      <h1 className="text-3xl font-bold text-slate-900 mb-2">
        Add New Product
      </h1>
      <p className="text-base text-slate-500 mb-8">
        Add a new product to your inventory catalog
      </p>

      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <ProductForm mode="create" onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
