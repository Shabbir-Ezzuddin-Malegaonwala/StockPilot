// cn() — conditional class name utility
// Combines class names, filtering out falsy values
// Used throughout the app for conditional Tailwind classes
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

// Format currency
export function formatPrice(price: string | number): string {
  const num = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

// Format date
export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateStr));
}

// Format date with time
export function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

// Generate slug from name (for organization creation)
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

// Stock level helper — determines the stock status
export function getStockStatus(
  currentStock: number,
  reorderLevel: number
): "in-stock" | "low-stock" | "out-of-stock" {
  if (currentStock === 0) return "out-of-stock";
  if (currentStock < reorderLevel) return "low-stock";
  return "in-stock";
}
