/**
 * Zustand Store — HAND-WRITTEN (Assignment Requirement)
 *
 * This store manages the entire inventory state for the frontend.
 * All async actions handle loading and error states properly.
 * State is never mutated directly — always through set().
 * Changing filters or pagination triggers a re-fetch automatically.
 */

import { create } from "zustand";
import type {
  Product,
  ProductWithMovements,
  StockMovement,
  ProductStats,
  ProductFilters,
  CreateProductInput,
  UpdateProductInput,
  StockAdjustInput,
  PaginatedResponse,
} from "@/types";
import * as api from "@/lib/api";

interface InventoryState {
  // Data
  products: Product[];
  selectedProduct: ProductWithMovements | null;
  movements: StockMovement[];
  categories: string[];

  // Stats (fetched separately from /products/stats)
  stats: ProductStats;

  // UI state
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;

  // Filters
  filters: ProductFilters;

  // Pagination
  currentPage: number;
  totalPages: number;
  total: number;
  limit: number;

  // Actions — Products
  fetchProducts: () => Promise<void>;
  fetchProduct: (id: string) => Promise<void>;
  createProduct: (data: CreateProductInput) => Promise<Product>;
  updateProduct: (id: string, data: UpdateProductInput) => Promise<Product>;
  deleteProduct: (id: string) => Promise<void>;

  // Actions — Stock
  adjustStock: (id: string, data: StockAdjustInput) => Promise<Product>;
  analyzeProduct: (id: string) => Promise<void>;

  // Actions — Movements
  fetchMovements: (productId: string, page?: number) => Promise<void>;

  // Actions — Stats & Categories
  fetchStats: () => Promise<void>;
  fetchCategories: () => Promise<void>;

  // Actions — Filters & Pagination
  setFilter: (key: keyof ProductFilters, value: string) => void;
  resetFilters: () => void;
  setPage: (page: number) => void;

  // Actions — Error
  clearError: () => void;
}

const DEFAULT_FILTERS: ProductFilters = {
  search: "",
  category: "",
  status: "all",
  stockLevel: "all",
};

const DEFAULT_STATS: ProductStats = {
  totalProducts: 0,
  lowStockCount: 0,
  outOfStockCount: 0,
  totalInventoryValue: 0,
};

export const useInventoryStore = create<InventoryState>((set, get) => ({
  // Initial state
  products: [],
  selectedProduct: null,
  movements: [],
  categories: [],
  stats: DEFAULT_STATS,
  isLoading: false,
  isSubmitting: false,
  error: null,
  filters: DEFAULT_FILTERS,
  currentPage: 1,
  totalPages: 1,
  total: 0,
  limit: 20,

  // Fetch paginated product list
  fetchProducts: async () => {
    const { filters, currentPage, limit } = get();
    set({ isLoading: true, error: null });

    try {
      const result: PaginatedResponse<Product> = await api.getProducts(
        filters,
        currentPage,
        limit
      );
      set({
        products: result.data,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / limit)),
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String((err as { error?: string }).error || "Failed to fetch products");
      set({ error: message, isLoading: false });
    }
  },

  // Fetch single product with recent movements
  fetchProduct: async (id: string) => {
    set({ isLoading: true, error: null, selectedProduct: null });

    try {
      const product = await api.getProduct(id);
      set({
        selectedProduct: product,
        movements: product.recentMovements,
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String((err as { error?: string }).error || "Failed to fetch product");
      set({ error: message, isLoading: false });
    }
  },

  // Create a new product
  createProduct: async (data: CreateProductInput) => {
    set({ isSubmitting: true, error: null });

    try {
      const product = await api.createProduct(data);
      set({ isSubmitting: false });
      return product;
    } catch (err) {
      const message = err instanceof Error ? err.message : String((err as { error?: string }).error || "Failed to create product");
      set({ error: message, isSubmitting: false });
      throw new Error(message);
    }
  },

  // Update existing product
  updateProduct: async (id: string, data: UpdateProductInput) => {
    set({ isSubmitting: true, error: null });

    try {
      const product = await api.updateProduct(id, data);
      set({ isSubmitting: false });

      // If this product is currently selected, update it
      const { selectedProduct } = get();
      if (selectedProduct && selectedProduct.id === id) {
        set({
          selectedProduct: { ...selectedProduct, ...product },
        });
      }

      return product;
    } catch (err) {
      const message = err instanceof Error ? err.message : String((err as { error?: string }).error || "Failed to update product");
      set({ error: message, isSubmitting: false });
      throw new Error(message);
    }
  },

  // Soft-delete (discontinue) a product
  deleteProduct: async (id: string) => {
    set({ isSubmitting: true, error: null });

    try {
      await api.deleteProduct(id);
      set({ isSubmitting: false });

      // Remove from list or update status
      const { products } = get();
      set({
        products: products.map((p) =>
          p.id === id ? { ...p, status: "discontinued" as const } : p
        ),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String((err as { error?: string }).error || "Failed to delete product");
      set({ error: message, isSubmitting: false });
      throw new Error(message);
    }
  },

  // Adjust stock level
  adjustStock: async (id: string, data: StockAdjustInput) => {
    set({ isSubmitting: true, error: null });

    try {
      const updatedProduct = await api.adjustStock(id, data);
      set({ isSubmitting: false });

      // Update the product in the list
      const { products, selectedProduct } = get();
      set({
        products: products.map((p) =>
          p.id === id ? { ...p, ...updatedProduct } : p
        ),
      });

      // If this product is currently selected, refresh it
      if (selectedProduct && selectedProduct.id === id) {
        set({
          selectedProduct: {
            ...selectedProduct,
            ...updatedProduct,
          },
        });
      }

      return updatedProduct;
    } catch (err) {
      const message = err instanceof Error ? err.message : String((err as { error?: string }).error || "Failed to adjust stock");
      set({ error: message, isSubmitting: false });
      throw new Error(message);
    }
  },

  // Trigger AI analysis on a product
  analyzeProduct: async (id: string) => {
    set({ isSubmitting: true, error: null });

    try {
      const updatedProduct = await api.analyzeProduct(id);
      set({ isSubmitting: false });

      // Update selected product with AI results
      const { selectedProduct } = get();
      if (selectedProduct && selectedProduct.id === id) {
        set({
          selectedProduct: {
            ...selectedProduct,
            aiRecommendation: updatedProduct.aiRecommendation,
            aiReasoning: updatedProduct.aiReasoning,
            aiAnalyzedAt: updatedProduct.aiAnalyzedAt,
          },
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String((err as { error?: string }).error || "AI analysis failed");
      set({ error: message, isSubmitting: false });
    }
  },

  // Fetch paginated movements for a product
  fetchMovements: async (productId: string, page: number = 1) => {
    try {
      const result = await api.getProductMovements(productId, page);
      set({ movements: result.data });
    } catch (err) {
      const message = err instanceof Error ? err.message : String((err as { error?: string }).error || "Failed to fetch movements");
      set({ error: message });
    }
  },

  // Fetch dashboard stats
  fetchStats: async () => {
    try {
      const stats = await api.getProductStats();
      set({ stats });
    } catch {
      // Stats failure is non-critical — don't set error
      set({ stats: DEFAULT_STATS });
    }
  },

  // Fetch unique categories for filter dropdown
  fetchCategories: async () => {
    try {
      const result = await api.getCategories();
      set({ categories: result.data });
    } catch {
      // Categories failure is non-critical
      set({ categories: [] });
    }
  },

  // Set a filter value — triggers re-fetch by resetting to page 1
  setFilter: (key: keyof ProductFilters, value: string) => {
    const { filters } = get();
    set({
      filters: { ...filters, [key]: value },
      currentPage: 1, // Reset to page 1 when filter changes
    });

    // Auto-fetch after filter change
    get().fetchProducts();
  },

  // Reset all filters
  resetFilters: () => {
    set({ filters: DEFAULT_FILTERS, currentPage: 1 });
    get().fetchProducts();
  },

  // Set page — triggers re-fetch
  setPage: (page: number) => {
    set({ currentPage: page });
    get().fetchProducts();
  },

  // Clear error message
  clearError: () => set({ error: null }),
}));
