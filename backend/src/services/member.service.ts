/**
 * Member Service — Handles organization member management and invitations.
 *
 * Uses raw SQL queries on BetterAuth's auto-managed tables:
 * - "user" table: id, name, email, image, createdAt, updatedAt
 * - "member" table: id, organizationId, userId, role, createdAt
 * - "invitation" table: id, organizationId, email, role, status, inviterId, expiresAt, createdAt
 * - "organization" table: id, name, slug, logo, createdAt, metadata
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

// ─── Member Queries ──────────────────────────────────────────────────────────

/** List all members of an organization with their user details */
export async function getOrgMembers(organizationId: string) {
  const result = await db.execute(
    sql`SELECT m.id, m.role, m."createdAt" as "joinedAt",
               u.name, u.email, u.image
        FROM member m
        JOIN "user" u ON m."userId" = u.id
        WHERE m."organizationId" = ${organizationId}
        ORDER BY m."createdAt" ASC`
  );
  return result.rows;
}

/** Get current user's role in the active organization */
export async function getUserRole(organizationId: string, userId: string) {
  const result = await db.execute(
    sql`SELECT m.role, o.name as "organizationName", o.slug as "organizationSlug"
        FROM member m
        JOIN organization o ON m."organizationId" = o.id
        WHERE m."organizationId" = ${organizationId} AND m."userId" = ${userId}
        LIMIT 1`
  );
  return result.rows[0] ?? null;
}

/** Change a member's role */
export async function changeMemberRole(memberId: string, organizationId: string, newRole: string) {
  // Prevent changing the owner's role
  const member = await db.execute(
    sql`SELECT role, "userId" FROM member WHERE id = ${memberId} AND "organizationId" = ${organizationId} LIMIT 1`
  );
  const row = member.rows[0] as { role: string; userId: string } | undefined;
  if (!row) return { error: "NOT_FOUND" as const };
  if (row.role === "owner") return { error: "CANNOT_CHANGE_OWNER" as const };

  await db.execute(
    sql`UPDATE member SET role = ${newRole} WHERE id = ${memberId} AND "organizationId" = ${organizationId}`
  );
  return { success: true };
}

/** Remove a member from the organization */
export async function removeMember(memberId: string, organizationId: string) {
  // Prevent removing the owner
  const member = await db.execute(
    sql`SELECT role FROM member WHERE id = ${memberId} AND "organizationId" = ${organizationId} LIMIT 1`
  );
  const row = member.rows[0] as { role: string } | undefined;
  if (!row) return { error: "NOT_FOUND" as const };
  if (row.role === "owner") return { error: "CANNOT_REMOVE_OWNER" as const };

  await db.execute(
    sql`DELETE FROM member WHERE id = ${memberId} AND "organizationId" = ${organizationId}`
  );
  return { success: true };
}

// ─── Invitation Queries ──────────────────────────────────────────────────────

/** Create a new invitation */
export async function createInvitation(
  organizationId: string,
  email: string,
  role: string,
  inviterId: string
) {
  // Check if this email is already a member of this org
  const existingMember = await db.execute(
    sql`SELECT m.id FROM member m
        JOIN "user" u ON m."userId" = u.id
        WHERE m."organizationId" = ${organizationId} AND u.email = ${email}
        LIMIT 1`
  );
  if (existingMember.rows.length > 0) {
    return { error: "ALREADY_MEMBER" as const };
  }

  // Check if there's already a pending invitation for this email in this org
  const existingInvite = await db.execute(
    sql`SELECT id FROM invitation
        WHERE "organizationId" = ${organizationId} AND email = ${email} AND status = 'pending'
        LIMIT 1`
  );
  if (existingInvite.rows.length > 0) {
    return { error: "ALREADY_INVITED" as const };
  }

  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

  await db.execute(
    sql`INSERT INTO invitation (id, "organizationId", email, role, status, "inviterId", "expiresAt", "createdAt")
        VALUES (${id}, ${organizationId}, ${email}, ${role}, 'pending', ${inviterId}, ${expiresAt}, NOW())`
  );

  // Get org name for the response message
  const orgResult = await db.execute(
    sql`SELECT name FROM organization WHERE id = ${organizationId} LIMIT 1`
  );
  const orgName = (orgResult.rows[0] as { name: string })?.name ?? "Unknown";

  // Get inviter name
  const inviterResult = await db.execute(
    sql`SELECT name FROM "user" WHERE id = ${inviterId} LIMIT 1`
  );
  const inviterName = (inviterResult.rows[0] as { name: string })?.name ?? "Admin";

  return {
    data: {
      invitationId: id,
      email,
      role,
      organizationName: orgName,
      inviterName,
      expiresAt: expiresAt.toISOString(),
    },
  };
}

/** Check if an email has pending invitations (used during signup/login flow) */
export async function checkPendingInvitations(email: string) {
  const result = await db.execute(
    sql`SELECT i.id, i.role, i.status, i."expiresAt",
               o.name as "organizationName", o.id as "organizationId",
               u.name as "inviterName"
        FROM invitation i
        JOIN organization o ON i."organizationId" = o.id
        JOIN "user" u ON i."inviterId" = u.id
        WHERE i.email = ${email} AND i.status = 'pending' AND i."expiresAt" > NOW()
        ORDER BY i."createdAt" DESC`
  );
  return result.rows;
}

/** Accept an invitation — adds user to the organization with assigned role */
export async function acceptInvitation(invitationId: string, userId: string) {
  // Get invitation details
  const invResult = await db.execute(
    sql`SELECT * FROM invitation WHERE id = ${invitationId} AND status = 'pending' LIMIT 1`
  );
  const invitation = invResult.rows[0] as {
    organizationId: string;
    email: string;
    role: string;
    expiresAt: Date;
  } | undefined;

  if (!invitation) return { error: "INVALID_INVITATION" as const };

  // Check expiry
  if (new Date(invitation.expiresAt) < new Date()) {
    await db.execute(sql`UPDATE invitation SET status = 'canceled' WHERE id = ${invitationId}`);
    return { error: "INVITATION_EXPIRED" as const };
  }

  // Check if user is already a member
  const existingMember = await db.execute(
    sql`SELECT id FROM member WHERE "organizationId" = ${invitation.organizationId} AND "userId" = ${userId} LIMIT 1`
  );
  if (existingMember.rows.length > 0) {
    await db.execute(sql`UPDATE invitation SET status = 'accepted' WHERE id = ${invitationId}`);
    return { error: "ALREADY_MEMBER" as const };
  }

  // Add user to organization
  const memberId = crypto.randomUUID();
  await db.execute(
    sql`INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
        VALUES (${memberId}, ${invitation.organizationId}, ${userId}, ${invitation.role}, NOW())`
  );

  // Mark invitation as accepted
  await db.execute(
    sql`UPDATE invitation SET status = 'accepted' WHERE id = ${invitationId}`
  );

  return {
    data: {
      memberId,
      organizationId: invitation.organizationId,
      role: invitation.role,
    },
  };
}

/** List pending invitations for an organization (for admin view) */
export async function getOrgPendingInvitations(organizationId: string) {
  const result = await db.execute(
    sql`SELECT i.id, i.email, i.role, i.status, i."expiresAt", i."createdAt",
               u.name as "inviterName"
        FROM invitation i
        JOIN "user" u ON i."inviterId" = u.id
        WHERE i."organizationId" = ${organizationId} AND i.status = 'pending' AND i."expiresAt" > NOW()
        ORDER BY i."createdAt" DESC`
  );
  return result.rows;
}

/** Cancel a pending invitation */
export async function cancelInvitation(invitationId: string, organizationId: string) {
  const result = await db.execute(
    sql`UPDATE invitation SET status = 'canceled'
        WHERE id = ${invitationId} AND "organizationId" = ${organizationId} AND status = 'pending'`
  );
  return (result.rowCount ?? 0) > 0;
}
