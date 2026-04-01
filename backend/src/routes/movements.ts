import { Elysia } from "elysia";
import { getSessionAndRole, hasRole } from "../lib/session";
import { movementQuerySchema } from "../schemas/validation";
import * as movementService from "../services/movement.service";

export const movementRoutes = new Elysia({ prefix: "/movements" })
  // GET /movements — all org movements (manager+)
  .get("/", async ({ headers, query, set }) => {
    const sessionData = await getSessionAndRole(headers);
    if (!sessionData) { set.status = 401; return { error: "Unauthorized" }; }
    if (!hasRole(sessionData.role, "manager")) { set.status = 403; return { error: "Forbidden" }; }

    const parsed = movementQuerySchema.safeParse(query);
    if (!parsed.success) { set.status = 400; return { error: parsed.error.flatten().fieldErrors }; }

    return movementService.getAllMovements(sessionData.organizationId, parsed.data);
  });
