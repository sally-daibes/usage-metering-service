
import type { FastifyInstance } from "fastify";

import { authenticateAccount } from "../accounts/auth.js";
import { consumeUnits } from "./consumption.service.js";

type ConsumeBody = {
  userId: number;
  requestId: string;
  units: number;
};

export async function consumptionRoutes(
  app: FastifyInstance,
) {
  app.post<{ Body: ConsumeBody }>(
    "/consume",
    {
      preHandler: authenticateAccount,
      schema: {
        body: {
          type: "object",
          required: ["userId", "requestId", "units"],
          additionalProperties: false,
          properties: {
            userId: {
              type: "integer",
              minimum: 1,
              maximum: Number.MAX_SAFE_INTEGER,
            },
            requestId: {
              type: "string",
              minLength: 1,
              maxLength: 255,
            },
            units: {
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

      const { userId, units } = request.body;
      const requestId = request.body.requestId.trim();

      if (!requestId) {
        return reply.code(400).send({
          error: "Bad Request",
          message: "requestId cannot be empty",
        });
      }

      const result = await consumeUnits(
        accountId,
        userId,
        requestId,
        units,
      );

      if (result.kind === "not_found") {
        return reply.code(404).send({
          error: "Not Found",
          message: "User not found",
        });
      }

      if (result.kind === "conflict") {
        return reply.code(409).send({
          error: "Conflict",
          message:
            "requestId already used with different data",
        });
      }

      return reply.code(200).send({
        ...result.decision,
        replayed: result.replayed,
      });
    },
  );
}
