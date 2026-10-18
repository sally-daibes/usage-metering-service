
import type { FastifyInstance } from "fastify";

import { authenticateAccount } from "../accounts/auth.js";
import { getAccountHistory } from "./history.service.js";

type HistoryQuery = {
  userId?: number;
  limit?: number;
  offset?: number;
};

export async function historyRoutes(app: FastifyInstance) {
  app.get<{ Querystring: HistoryQuery }>(
    "/history",
    {
      preHandler: authenticateAccount,
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            userId: {
              type: "integer",
              minimum: 1,
              maximum: Number.MAX_SAFE_INTEGER,
            },
            limit: {
              type: "integer",
              minimum: 1,
              maximum: 100,
            },
            offset: {
              type: "integer",
              minimum: 0,
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

      const {
        userId,
        limit = 20,
        offset = 0,
      } = request.query;


const result = await getAccountHistory(
  accountId,
  {
    ...(userId !== undefined ? { userId } : {}),
    limit,
    offset,
  },
);


      return reply.code(200).send(result);
    },
  );
}
