"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useInventoryStore } from "@/store/inventory.store";
import { useAuthStore } from "@/store/auth.store";
import { cn, formatPrice } from "@/lib/utils";
import { StockBadge } from "@/components/ui/StockBadge";
import * as api from "@/lib/api";
import type { StockMovement } from "@/types";

export default function DashboardPage() {
  const { stats, products, fetchProducts, fetchStats } = useInventoryStore();
  const { user, role, organization, hasRole } = useAuthStore();
  const canCreateProduct = hasRole("manager");

  const [recentMovements, setRecentMovements] = useState<StockMovement[]>([]);
  const [totalValue, setTotalValue] = useState<number>(0);

  useEffect(() => {
    fetchStats();
    fetchProducts();

    // Fetch recent movements for activity feed
    api.getRecentMovements(8).then((res) => {
      setRecentMovements(res.data);
    }).catch(() => {});

    // Fetch total inventory value from stats
    api.getProductStats().then((res) => {
      const statsData = res as { totalProducts: number; lowStockCount: number; outOfStockCount: number; totalInventoryValue?: number };
      setTotalValue(statsData.totalInventoryValue ?? 0);
    }).catch(() => {});
  }, [fetchStats, fetchProducts]);

  const statCards = [
    {
      label: "TOTAL PRODUCTS",
      value: stats.totalProducts.toLocaleString(),
      subtitle: "In your inventory catalog",
      icon: (
        <svg className="h-7 w-7 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
        </svg>
      ),
      bg: "bg-indigo-50",
      textColor: "text-slate-900",
    },
    {
      label: "INVENTORY VALUE",
      value: `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      subtitle: "Total stock value",
      icon: (
        <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
      bg: "bg-emerald-50",
      textColor: "text-emerald-700",
    },
    {
      label: "LOW STOCK",
      value: stats.lowStockCount.toString(),
      subtitle: "Items below threshold",
      icon: (
        <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      ),
      bg: "bg-amber-50",
      textColor: "text-amber-700",
    },
    {
      label: "OUT OF STOCK",
      value: stats.outOfStockCount.toLocaleString(),
      subtitle: stats.outOfStockCount > 0 ? "Critical: Urgent restock" : "No out-of-stock items",
      icon: (
        <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
      bg: stats.outOfStockCount > 0 ? "bg-red-50" : "bg-slate-50",
      textColor: stats.outOfStockCount > 0 ? "text-red-700" : "text-slate-900",
    },
  ];

  // Show items that need attention: low stock + out of stock
  const alertProducts = products.filter(
    (p) => p.status === "active" && p.currentStock <= p.reorderLevel
  );

  // Format relative time for movements
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const movementTypeLabel: Record<string, { label: string; color: string }> = {
    received: { label: "Received", color: "text-emerald-600" },
    sold: { label: "Sold", color: "text-red-600" },
    returned: { label: "Returned", color: "text-blue-600" },
    adjustment: { label: "Adjusted", color: "text-slate-600" },
    damaged: { label: "Damaged", color: "text-orange-600" },
  };

  return (
    <div>
      {/* Page header with role welcome */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Welcome back, {user?.name?.split(" ")[0] || "User"}
            </h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-slate-500">
              {role && (
                <span className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider mr-2",
                  role === "owner" ? "bg-purple-100 text-purple-700" :
                  role === "admin" ? "bg-red-100 text-red-700" :
                  role === "manager" ? "bg-blue-100 text-blue-700" :
                  "bg-gray-100 text-gray-700"
                )}>
                  {role}
                </span>
              )}
              {organization?.name || "Organization"} &mdash; Inventory Overview
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {canCreateProduct && (
              <Link
                href="/products/new"
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl",
                  "bg-gradient-to-br from-[#3525cd] to-[#4f46e5] px-3 sm:px-6 py-2 sm:py-3",
                  "text-sm sm:text-[15px] font-medium text-white",
                  "transition-all hover:shadow-lg hover:shadow-indigo-200"
                )}
              >
                <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="hidden sm:inline">Add Product</span>
                <span className="sm:hidden">Add</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Stat cards — 4 columns */}
      <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4 mb-6 sm:mb-10">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="flex items-center justify-between rounded-2xl bg-white p-4 sm:p-6 shadow-sm"
          >
            <div>
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1 sm:mb-2">
                {card.label}
              </p>
              <p className={cn("text-2xl sm:text-3xl lg:text-4xl font-bold", card.textColor)}>
                {card.value}
              </p>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 hidden sm:block">{card.subtitle}</p>
            </div>
            <div
              className={cn(
                "hidden sm:flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl flex-shrink-0",
                card.bg
              )}
            >
              {card.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Two-column layout: Stock Alerts + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Stock Alerts — takes 3 cols */}
        <div className="lg:col-span-3 rounded-2xl bg-white p-4 sm:p-6 lg:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 sm:mb-6">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
                Stock Alerts
              </h2>
              <p className="mt-0.5 text-sm sm:text-base text-slate-500">
                Products that need restocking
              </p>
            </div>
            <Link
              href="/products"
              className="text-sm sm:text-[15px] font-medium text-indigo-600 hover:text-indigo-700"
            >
              View all products
            </Link>
          </div>

          {alertProducts.length === 0 ? (
            <div className="py-12 text-center">
              <svg className="mx-auto h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <p className="mt-3 text-lg font-medium text-slate-600">All stock levels are healthy</p>
              <p className="mt-1 text-base text-slate-400">No products are below their reorder threshold</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <th className="pb-4 pr-4 text-xs font-semibold uppercase tracking-widest text-slate-400">Product</th>
                    <th className="pb-4 pr-4 text-xs font-semibold uppercase tracking-widest text-slate-400">SKU</th>
                    <th className="pb-4 pr-4 text-xs font-semibold uppercase tracking-widest text-slate-400">Stock</th>
                    <th className="pb-4 pr-4 text-xs font-semibold uppercase tracking-widest text-slate-400">Reorder</th>
                    <th className="pb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {alertProducts.slice(0, 8).map((product) => (
                    <tr key={product.id} className="group">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/products/${product.id}`}
                          className="text-[15px] font-medium text-slate-900 group-hover:text-indigo-600 transition-colors"
                        >
                          {product.name}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-[15px] font-mono text-slate-500">{product.sku}</td>
                      <td className="py-3 pr-4 text-[15px] font-semibold text-slate-900">{product.currentStock}</td>
                      <td className="py-3 pr-4 text-[15px] text-slate-500">{product.reorderLevel}</td>
                      <td className="py-3">
                        <StockBadge currentStock={product.currentStock} reorderLevel={product.reorderLevel} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Activity — takes 2 cols */}
        <div className="lg:col-span-2 rounded-2xl bg-white p-4 sm:p-6 lg:p-8 shadow-sm">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-900 mb-4 sm:mb-6">
            Recent Activity
          </h2>

          {recentMovements.length === 0 ? (
            <div className="py-12 text-center">
              <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <p className="mt-3 text-base text-slate-400">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentMovements.map((movement) => {
                const info = movementTypeLabel[movement.movementType] || { label: movement.movementType, color: "text-slate-600" };
                const isPositive = movement.movementType === "received" || movement.movementType === "returned";
                return (
                  <div key={movement.id} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                    <div className={cn(
                      "mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                      isPositive ? "bg-emerald-50" : "bg-red-50"
                    )}>
                      <svg className={cn("h-4 w-4", isPositive ? "text-emerald-500" : "text-red-500")} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        {isPositive ? (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
                        )}
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        <span className={cn("font-semibold", info.color)}>{info.label}</span>
                        {" "}&middot;{" "}
                        <span className={cn("font-bold", isPositive ? "text-emerald-600" : "text-red-600")}>
                          {isPositive ? "+" : ""}{movement.quantity}
                        </span>
                        {" "}units
                      </p>
                      {movement.reason && (
                        <p className="text-xs text-slate-400 truncate">{movement.reason}</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
                      {timeAgo(movement.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
