
import { and, eq, isNull } from "drizzle-orm";

import { db } from "../../db/client.js";
import {
  users,
  plans,
  planAssignments,
} from "../../db/schema.js";

export async function createUserForAccount(
  accountId: number,
  externalId: string,
) {
  const userExternalId = externalId.trim();

  if (!userExternalId || userExternalId.length > 255) {
    throw new Error("Invalid user external ID");
  }

  return db.transaction(async (tx) => {
    const [basicPlan] = await tx
      .select({ id: plans.id })
      .from(plans)
      .where(
        and(
          eq(plans.name, "Basic"),
          eq(plans.planType, "user"),
          eq(plans.isPredefined, true),
          isNull(plans.ownerAccountId),
        ),
      )
      .limit(1);

    if (!basicPlan) {
      throw new Error("Basic plan not found");
    }

    const [user] = await tx
      .insert(users)
      .values({
        accountId,
        externalId: userExternalId,
      })
      .returning({
        id: users.id,
        externalId: users.externalId,
      });

    if (!user) {
      throw new Error("Failed to create user");
    }

    await tx.insert(planAssignments).values({
      planId: basicPlan.id,
      planType: "user",
      userId: user.id,
    });

    return {
      userId: user.id,
      accountId,
      externalId: user.externalId,
      plan: "Basic",
    };
  });
}


export async function getUserForAccount(
  accountId: number,
  userId: number,
) {
  const [user] = await db
    .select({
      userId: users.id,
      accountId: users.accountId,
      externalId: users.externalId,
    })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        eq(users.accountId, accountId),
      ),
    )
    .limit(1);

  return user ?? null;
}
