
import type { FastifyInstance } from "fastify";

import { authenticateAccount } from "../accounts/auth.js";
import {
  createUserForAccount,
  getUserForAccount,
} from "./user.service.js";

type CreateUserBody = {
  externalId: string;
};

function isDuplicateUser(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const wrapped = error as {
    code?: string;
    cause?: {
      code?: string;
      constraint?: string;
    };
    constraint?: string;
  };

  const dbError = wrapped.cause ?? wrapped;

  return (
    dbError.code === "23505" &&
    dbError.constraint === "users_account_external_id_unique"
  );
}

export async function userRoutes(app: FastifyInstance) {
  app.post<{ Body: CreateUserBody }>(
    "/users",
    {
      preHandler: authenticateAccount,
      schema: {
        body: {
          type: "object",
          required: ["externalId"],
          additionalProperties: false,
          properties: {
            externalId: {
              type: "string",
              minLength: 1,
              maxLength: 255,
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

      const externalId = request.body.externalId.trim();

      if (!externalId) {
        return reply.code(400).send({
          error: "Bad Request",
          message: "externalId cannot be empty",
        });
      }

      try {
        const user = await createUserForAccount(
          accountId,
          externalId,
        );

        return reply.code(201).send(user);
      } catch (error) {
        if (isDuplicateUser(error)) {
          return reply.code(409).send({
            error: "Conflict",
            message: "User already exists in this account",
          });
        }

        throw error;
      }
    },
  );

  app.get<{ Params: { userId: string } }>(
    "/users/:userId",
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

      const user = await getUserForAccount(
        accountId,
        userId,
      );

      if (!user) {
        return reply.code(404).send({
          error: "Not Found",
          message: "User not found",
        });
      }

      return reply.code(200).send(user);
    },
  );

}
