
import type { FastifyInstance } from "fastify";

import { authenticateAccount } from "../accounts/auth.js";
import { createCustomPlan } from "./plan.service.js";
import { assignPlanToUser } from "./assignment.service.js";

type CreatePlanBody = {
  name: string;
  planType: "account" | "user";
  monthlyAllowance: number;
  maxUnitsPerRequest: number;
};
type AssignUserPlanParams = {
  userId: string;
};

type AssignUserPlanBody = {
  planId: number;
};

function isDuplicatePlan(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const wrapped = error as {
    code?: string;
    constraint?: string;
    cause?: {
      code?: string;
      constraint?: string;
    };
  };

  const dbError = wrapped.cause ?? wrapped;

  return (
    dbError.code === "23505" &&
    dbError.constraint === "custom_plan_owner_name_type_unique"
  );
}

export async function planRoutes(app: FastifyInstance) {
  app.post<{ Body: CreatePlanBody }>(
    "/plans",
    {
      preHandler: authenticateAccount,
      schema: {
        body: {
          type: "object",
          required: [
            "name",
            "planType",
            "monthlyAllowance",
            "maxUnitsPerRequest",
          ],
          additionalProperties: false,
          properties: {
            name: {
              type: "string",
              minLength: 1,
              maxLength: 100,
            },
            planType: {
              type: "string",
              enum: ["account", "user"],
            },
            monthlyAllowance: {
              type: "integer",
              minimum: 0,
              maximum: Number.MAX_SAFE_INTEGER,
            },
            maxUnitsPerRequest: {
              type: "integer",
              minimum: 1,
              maximum: Number.MAX_SAFE_INTEGER,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const accountId = request.accountId;

      if (accountId === null) {
        return reply.code(401).send({
          error: "Unauthorized",
        });
      }

      const name = request.body.name.trim();

      if (!name) {
        return reply.code(400).send({
          error: "Bad Request",
          message: "Plan name cannot be empty",
        });
      }

      try {
        const plan = await createCustomPlan(accountId, {
          ...request.body,
          name,
        });

        return reply.code(201).send(plan);
      } catch (error) {
        if (isDuplicatePlan(error)) {
          return reply.code(409).send({
            error: "Conflict",
            message: "Plan already exists in this account",
          });
        }

        throw error;
      }
    },
  );

  app.put<{
    Params: AssignUserPlanParams;
    Body: AssignUserPlanBody;
  }>(
    "/users/:userId/plan",
    {
      preHandler: authenticateAccount,
      schema: {
        params: {
          type: "object",
          required: ["userId"],
          properties: {
            userId: {
              type: "string",
              pattern: "^[1-9][0-9]*$",
            },
          },
        },
        body: {
          type: "object",
          required: ["planId"],
          additionalProperties: false,
          properties: {
            planId: {
              type: "integer",
              minimum: 1,
              maximum: Number.MAX_SAFE_INTEGER,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const accountId = request.accountId;
      const userId = Number(request.params.userId);

      if (accountId === null) {
        return reply.code(401).send({
          error: "Unauthorized",
        });
      }

      if (!Number.isSafeInteger(userId) || userId <= 0) {
        return reply.code(400).send({
          error: "Bad Request",
          message: "Invalid user ID",
        });
      }

      const result = await assignPlanToUser(
        accountId,
        userId,
        request.body.planId,
      );

      if (result.status === "user_not_found") {
        return reply.code(404).send({
          error: "Not Found",
          message: "User not found",
        });
      }

      if (result.status === "plan_not_available") {
        return reply.code(404).send({
          error: "Not Found",
          message: "Plan not found or not available",
        });
      }

      return reply.code(200).send(result);
    },
  );

}
