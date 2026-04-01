// Centralized API client — every backend call goes through here
// credentials: "include" ensures the session cookie is sent with every request

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ApiError {
  error: string;
  status: number;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Origin: typeof window !== "undefined" ? window.location.origin : "",
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody.error) {
        errorMessage = typeof errorBody.error === "string"
          ? errorBody.error
          : JSON.stringify(errorBody.error);
      }
    } catch {
      // Response body wasn't JSON — use default message
    }

    const error: ApiError = { error: errorMessage, status: response.status };
    throw error;
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// --- Auth endpoints ---

export async function getSession() {
  return request<{ session: { id: string; userId: string; activeOrganizationId: string | null; expiresAt: string }; user: { id: string; name: string; email: string; image: string | null } } | null>(
    "/api/auth/get-session"
  );
}

export async function signIn(email: string, password: string) {
  return request<{ token: string; user: { id: string; name: string; email: string } }>(
    "/api/auth/sign-in/email",
    { method: "POST", body: JSON.stringify({ email, password }) }
  );
}

export async function signUp(name: string, email: string, password: string) {
  return request<{ token: string; user: { id: string; name: string; email: string } }>(
    "/api/auth/sign-up/email",
    { method: "POST", body: JSON.stringify({ name, email, password }) }
  );
}

export async function signOut() {
  return request<void>("/api/auth/sign-out", { method: "POST" });
}

export async function listOrganizations() {
  return request<Array<{ id: string; name: string; slug: string; logo: string | null; createdAt: string }>>(
    "/api/auth/organization/list"
  );
}

export async function createOrganization(name: string, slug: string) {
  return request<{ id: string; name: string; slug: string }>(
    "/api/auth/organization/create",
    { method: "POST", body: JSON.stringify({ name, slug }) }
  );
}

export async function setActiveOrganization(organizationId: string) {
  return request<{ id: string; name: string }>(
    "/api/auth/organization/set-active",
    { method: "POST", body: JSON.stringify({ organizationId }) }
  );
}

// --- Product endpoints ---

import type {
  Product,
  ProductWithMovements,
  PaginatedResponse,
  ProductStats,
  CreateProductInput,
  UpdateProductInput,
  StockAdjustInput,
  StockMovement,
  ProductFilters,
} from "@/types";

export async function getProducts(
  filters: ProductFilters,
  page: number = 1,
  limit: number = 20
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (filters.search) params.set("search", filters.search);
  if (filters.category) params.set("category", filters.category);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.stockLevel !== "all") params.set("stockLevel", filters.stockLevel);

  return request<PaginatedResponse<Product>>(`/products?${params}`);
}

export async function getProduct(id: string) {
  return request<ProductWithMovements>(`/products/${id}`);
}

export async function createProduct(data: CreateProductInput) {
  return request<Product>("/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProduct(id: string, data: UpdateProductInput) {
  return request<Product>(`/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteProduct(id: string) {
  return request<Product>(`/products/${id}`, { method: "DELETE" });
}

export async function adjustStock(id: string, data: StockAdjustInput) {
  return request<Product>(`/products/${id}/stock`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getProductStats() {
  return request<ProductStats>("/products/stats");
}

export async function getCategories() {
  return request<{ data: string[] }>("/products/categories");
}

export async function getProductMovements(
  productId: string,
  page: number = 1,
  limit: number = 20
) {
  return request<PaginatedResponse<StockMovement>>(
    `/products/${productId}/movements?page=${page}&limit=${limit}`
  );
}

// --- AI endpoints ---

export async function analyzeProduct(productId: string) {
  return request<Product>(`/ai/analyze/${productId}`, { method: "POST" });
}

// SSE endpoint URL (used by useSSEStream hook directly)
export function getProcurementReportURL() {
  return `${API_URL}/ai/procurement-report`;
}

// --- Settings/Member endpoints ---

export interface MemberInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  image: string | null;
  joinedAt: string;
}

export interface InvitationInfo {
  id: string;
  email: string;
  role: string;
  status: string;
  inviterName: string;
  expiresAt: string;
  createdAt: string;
}

export interface PendingInvitation {
  id: string;
  role: string;
  organizationName: string;
  organizationId: string;
  inviterName: string;
  expiresAt: string;
}

export interface RoleInfo {
  role: string;
  organizationName: string;
  organizationSlug: string;
}

/** Get current user's role in the active organization */
export async function getMyRole() {
  return request<RoleInfo>("/settings/my-role");
}

/** Check if an email has pending invitations (public — used during signup) */
export async function checkInvitation(email: string) {
  return request<{ invitations: PendingInvitation[] }>(
    `/settings/check-invitation?email=${encodeURIComponent(email)}`
  );
}

/** Get pending invitations for the logged-in user */
export async function getMyPendingInvitations() {
  return request<{ invitations: PendingInvitation[] }>("/settings/pending-invitations");
}

/** Accept an invitation */
export async function acceptInvitation(invitationId: string) {
  return request<{ memberId: string; organizationId: string; role: string }>(
    "/settings/accept-invitation",
    { method: "POST", body: JSON.stringify({ invitationId }) }
  );
}

/** List all org members + pending invitations (admin+) */
export async function getOrgMembers() {
  return request<{ members: MemberInfo[]; pendingInvitations: InvitationInfo[] }>(
    "/settings/members"
  );
}

/** Invite a new member (admin+) */
export async function inviteMember(email: string, role: string) {
  return request<{
    invitationId: string;
    email: string;
    role: string;
    organizationName: string;
    inviterName: string;
    expiresAt: string;
  }>("/settings/invite", {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}

/** Change a member's role (owner only) */
export async function changeMemberRole(memberId: string, role: string) {
  return request<{ success: boolean }>(`/settings/members/${memberId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

/** Remove a member from the organization (admin+) */
export async function removeMember(memberId: string) {
  return request<{ success: boolean }>(`/settings/members/${memberId}`, {
    method: "DELETE",
  });
}

/** Cancel a pending invitation (admin+) */
export async function cancelInvitation(invitationId: string) {
  return request<{ success: boolean }>(`/settings/invitations/${invitationId}`, {
    method: "DELETE",
  });
}

// --- Movement endpoints (for dashboard recent activity) ---

export async function getRecentMovements(limit: number = 10) {
  return request<{ data: StockMovement[]; total: number; page: number; limit: number }>(
    `/movements?page=1&limit=${limit}`
  );
}
