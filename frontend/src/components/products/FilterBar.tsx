"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useInventoryStore } from "@/store/inventory.store";
import { cn } from "@/lib/utils";

export function FilterBar() {
  const { filters, categories, setFilter, resetFilters, fetchCategories } =
    useInventoryStore();

  const [searchValue, setSearchValue] = useState(filters.search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Sync local search value when filters are reset externally
  useEffect(() => {
    setSearchValue(filters.search);
  }, [filters.search]);

  const handleSearch = useCallback(
    (value: string) => {
      setSearchValue(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setFilter("search", value);
      }, 300);
    },
    [setFilter]
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const hasActiveFilters =
    filters.search !== "" ||
    filters.category !== "" ||
    filters.status !== "all" ||
    filters.stockLevel !== "all";

  const selectClasses = cn(
    "h-12 rounded-xl bg-slate-50 px-4 pr-9 text-[15px] text-slate-700",
    "outline-none transition-colors",
    "hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-indigo-500/20",
    "appearance-none cursor-pointer"
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search input */}
      <div className="relative flex-1 min-w-[260px]">
        <svg
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
        <input
          type="text"
          value={searchValue}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Filter products..."
          className={cn(
            "h-12 w-full rounded-xl bg-slate-50 pl-11 pr-4 text-[15px] text-slate-700",
            "placeholder:text-slate-400 outline-none transition-colors",
            "hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
          )}
        />
      </div>

      {/* Category dropdown */}
      <div className="relative">
        <label className="sr-only">Category</label>
        <select
          value={filters.category}
          onChange={(e) => setFilter("category", e.target.value)}
          className={selectClasses}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
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

      {/* Status dropdown */}
      <div className="relative">
        <label className="sr-only">Status</label>
        <select
          value={filters.status}
          onChange={(e) => setFilter("status", e.target.value)}
          className={selectClasses}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="discontinued">Discontinued</option>
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
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

      {/* Stock Level dropdown */}
      <div className="relative">
        <label className="sr-only">Stock Level</label>
        <select
          value={filters.stockLevel}
          onChange={(e) => setFilter("stockLevel", e.target.value)}
          className={selectClasses}
        >
          <option value="all">Stock Level</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
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

      {/* Reset filters */}
      {hasActiveFilters && (
        <button
          onClick={resetFilters}
          className={cn(
            "h-12 rounded-xl px-4 text-[15px] font-medium text-red-500",
            "transition-colors hover:bg-red-50 hover:text-red-600"
          )}
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}
