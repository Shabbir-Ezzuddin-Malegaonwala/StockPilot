import { auth } from "./auth";
import { db } from "../db";
import { sql } from "drizzle-orm";

interface SessionData {
  userId: string;
  organizationId: string;
  role: string;
}

interface OrganizationSession {
  activeOrganizationId?: string;
}

export async function getSessionAndRole(
  headers: Record<string, string | undefined>
): Promise<SessionData | null> {
  const session = await auth.api.getSession({
    headers: new Headers(headers as Record<string, string>),
  });
  if (!session?.session || !session?.user) return null;

  const orgSession = session.session as unknown as OrganizationSession;
  const orgId = orgSession.activeOrganizationId;
  if (!orgId) return null;

  // Query member table directly — BetterAuth created this table
  const result = await db.execute(
    sql`SELECT role FROM member WHERE "organizationId" = ${orgId} AND "userId" = ${session.user.id} LIMIT 1`
  );

  const row = result.rows[0] as { role: string } | undefined;

  // If user is not a member of this organization, deny access
  if (!row) return null;

  const role = row.role || "member";

  return { userId: session.user.id, organizationId: orgId, role };
}

export function hasRole(userRole: string, requiredRole: string): boolean {
  const hierarchy: Record<string, number> = { owner: 4, admin: 3, manager: 2, member: 1 };
  return (hierarchy[userRole] || 0) >= (hierarchy[requiredRole] || 0);
}
