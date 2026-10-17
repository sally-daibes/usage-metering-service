
import type { FastifyRequest, FastifyReply } from "fastify";

import { getAccountIdFromApiKey } from "./api-key.service.js";

declare module "fastify" {
  interface FastifyRequest {
    accountId: number | null;
  }
}

export async function authenticateAccount(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const apiKey = request.headers["x-api-key"];

  const accountId = await getAccountIdFromApiKey(
    typeof apiKey === "string" ? apiKey : undefined,
  );

  if (accountId === null) {
    return reply.code(401).send({
      error: "Unauthorized",
      message: "Missing or invalid API key",
    });
  }

  request.accountId = accountId;
}
