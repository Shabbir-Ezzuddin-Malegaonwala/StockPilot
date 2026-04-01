"use client";

import { useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useInventoryStore } from "@/store/inventory.store";
import { ProductForm } from "@/components/products/ProductForm";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import type { CreateProductInput, UpdateProductInput } from "@/types";

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const { selectedProduct, isLoading, error, fetchProduct, updateProduct } =
    useInventoryStore();

  useEffect(() => {
    if (id) {
      fetchProduct(id);
    }
  }, [id, fetchProduct]);

  const handleSubmit = useCallback(
    async (data: CreateProductInput | UpdateProductInput) => {
      if (!id) return;
      await updateProduct(id, data as UpdateProductInput);
      router.push(`/products/${id}`);
    },
    [id, updateProduct, router]
  );

  // Loading state
  if (isLoading || !selectedProduct) {
    return <LoadingSpinner size="lg" message="Loading product..." />;
  }

  // Error state
  if (error) {
    return <ErrorState message={error} onRetry={() => id && fetchProduct(id)} />;
  }

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
        <Link
          href={`/products/${id}`}
          className="text-xs font-semibold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
        >
          {selectedProduct.name}
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
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-700">Edit</span>
      </nav>

      <h1 className="text-3xl font-bold text-slate-900 mb-2">
        Edit Product
      </h1>
      <p className="text-base text-slate-500 mb-8">
        Update product information for {selectedProduct.name}
      </p>

      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <ProductForm
          mode="edit"
          initialData={selectedProduct}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
