import { Elysia } from "elysia";
import { getSessionAndRole, hasRole } from "../lib/session";
import { inviteMemberSchema, changeRoleSchema } from "../schemas/validation";
import * as memberService from "../services/member.service";
import { auth } from "../lib/auth";

export const settingsRoutes = new Elysia({ prefix: "/settings" })

  // ─── Public (no auth needed) ─────────────────────────────────────────────

  // GET /settings/check-invitation?email=x
  // Used by the signup flow to check if an email has pending invitations
  .get("/check-invitation", async ({ query, set }) => {
    const email = query.email;
    if (!email || typeof email !== "string") {
      set.status = 400;
      return { error: "Email is required" };
    }

    const invitations = await memberService.checkPendingInvitations(email);
    return { invitations };
  })

  // ─── Authenticated (any member) ──────────────────────────────────────────

  // GET /settings/my-role — Get current user's role and org info
  .get("/my-role", async ({ headers, set }) => {
    const sessionData = await getSessionAndRole(headers);
    if (!sessionData) { set.status = 401; return { error: "Unauthorized" }; }

    const roleInfo = await memberService.getUserRole(
      sessionData.organizationId,
      sessionData.userId
    );

    if (!roleInfo) { set.status = 404; return { error: "Not a member of this organization" }; }

    return roleInfo;
  })

  // GET /settings/pending-invitations — Get invitations for the logged-in user
  .get("/pending-invitations", async ({ headers, set }) => {
    const session = await auth.api.getSession({
      headers: new Headers(headers as Record<string, string>),
    });
    if (!session?.user?.email) { set.status = 401; return { error: "Unauthorized" }; }

    const invitations = await memberService.checkPendingInvitations(session.user.email);
    return { invitations };
  })

  // POST /settings/accept-invitation — Accept an invitation
  .post("/accept-invitation", async ({ headers, body, set }) => {
    const session = await auth.api.getSession({
      headers: new Headers(headers as Record<string, string>),
    });
    if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

    const { invitationId } = body as { invitationId?: string };
    if (!invitationId) { set.status = 400; return { error: "Invitation ID is required" }; }

    const result = await memberService.acceptInvitation(invitationId, session.user.id);

    if ("error" in result) {
      const statusMap: Record<string, number> = {
        INVALID_INVITATION: 404,
        INVITATION_EXPIRED: 410,
        ALREADY_MEMBER: 409,
      };
      set.status = statusMap[result.error as string] || 400;
      return { error: result.error };
    }

    return result.data;
  })

  // ─── Admin+ Only ────────────────────────────────────────────────────────

  // GET /settings/members — List all organization members
  .get("/members", async ({ headers, set }) => {
    const sessionData = await getSessionAndRole(headers);
    if (!sessionData) { set.status = 401; return { error: "Unauthorized" }; }
    if (!hasRole(sessionData.role, "admin")) { set.status = 403; return { error: "Forbidden" }; }

    const [members, pendingInvitations] = await Promise.all([
      memberService.getOrgMembers(sessionData.organizationId),
      memberService.getOrgPendingInvitations(sessionData.organizationId),
    ]);

    return { members, pendingInvitations };
  })

  // POST /settings/invite — Create invitation for a new member
  .post("/invite", async ({ headers, body, set }) => {
    const sessionData = await getSessionAndRole(headers);
    if (!sessionData) { set.status = 401; return { error: "Unauthorized" }; }
    if (!hasRole(sessionData.role, "admin")) { set.status = 403; return { error: "Forbidden" }; }

    const parsed = inviteMemberSchema.safeParse(body);
    if (!parsed.success) { set.status = 400; return { error: parsed.error.flatten().fieldErrors }; }

    const result = await memberService.createInvitation(
      sessionData.organizationId,
      parsed.data.email,
      parsed.data.role,
      sessionData.userId
    );

    if ("error" in result) {
      const statusMap: Record<string, number> = {
        ALREADY_MEMBER: 409,
        ALREADY_INVITED: 409,
      };
      set.status = statusMap[result.error as string] || 400;
      return { error: result.error };
    }

    set.status = 201;
    return result.data;
  })

  // DELETE /settings/invitations/:id — Cancel a pending invitation
  .delete("/invitations/:id", async ({ headers, params, set }) => {
    const sessionData = await getSessionAndRole(headers);
    if (!sessionData) { set.status = 401; return { error: "Unauthorized" }; }
    if (!hasRole(sessionData.role, "admin")) { set.status = 403; return { error: "Forbidden" }; }

    const cancelled = await memberService.cancelInvitation(params.id, sessionData.organizationId);
    if (!cancelled) { set.status = 404; return { error: "Invitation not found" }; }

    return { success: true };
  })

  // ─── Owner Only ──────────────────────────────────────────────────────────

  // PATCH /settings/members/:id/role — Change a member's role
  .patch("/members/:id/role", async ({ headers, params, body, set }) => {
    const sessionData = await getSessionAndRole(headers);
    if (!sessionData) { set.status = 401; return { error: "Unauthorized" }; }
    if (!hasRole(sessionData.role, "owner")) { set.status = 403; return { error: "Only the owner can change roles" }; }

    const parsed = changeRoleSchema.safeParse(body);
    if (!parsed.success) { set.status = 400; return { error: parsed.error.flatten().fieldErrors }; }

    const result = await memberService.changeMemberRole(params.id, sessionData.organizationId, parsed.data.role);

    if ("error" in result) {
      const statusMap: Record<string, number> = {
        NOT_FOUND: 404,
        CANNOT_CHANGE_OWNER: 403,
      };
      set.status = statusMap[result.error as string] || 400;
      return { error: result.error };
    }

    return { success: true };
  })

  // DELETE /settings/members/:id — Remove a member from the organization
  .delete("/members/:id", async ({ headers, params, set }) => {
    const sessionData = await getSessionAndRole(headers);
    if (!sessionData) { set.status = 401; return { error: "Unauthorized" }; }
    if (!hasRole(sessionData.role, "admin")) { set.status = 403; return { error: "Forbidden" }; }

    const result = await memberService.removeMember(params.id, sessionData.organizationId);

    if ("error" in result) {
      const statusMap: Record<string, number> = {
        NOT_FOUND: 404,
        CANNOT_REMOVE_OWNER: 403,
      };
      set.status = statusMap[result.error as string] || 400;
      return { error: result.error };
    }

    return { success: true };
  });
