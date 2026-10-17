
import Fastify from "fastify";

import { authenticateAccount } from "./modules/accounts/auth.js";
import { userRoutes } from "./modules/users/user.routes.js";
import { planRoutes } from "./modules/plans/plan.routes.js";

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.decorateRequest("accountId", null);

  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.get(
    "/account",
    { preHandler: authenticateAccount },
    async (request) => {
      return {
        accountId: request.accountId,
      };
    },
  );

  app.register(userRoutes);
  app.register(planRoutes);

  return app;
}
