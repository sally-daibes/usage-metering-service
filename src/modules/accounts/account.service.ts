
import { randomBytes, createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "../../db/client.js";
import {
  accounts,
  apiKeys,
  plans,
  planAssignments,
} from "../../db/schema.js";

export async function createAccountWithKey(name: string) {
  const accountName = name.trim();

  if (!accountName || accountName.length > 150) {
    throw new Error("Account name must contain 1-150 characters");
  }

  const apiKey = `fts_${randomBytes(32).toString("hex")}`;

  const keyHash = createHash("sha256")
    .update(apiKey)
    .digest("hex");

  return db.transaction(async (tx) => {
    const [starterPlan] = await tx
      .select({ id: plans.id })
      .from(plans)
      .where(
        and(
          eq(plans.name, "Starter"),
          eq(plans.planType, "account"),
          eq(plans.isPredefined, true),
          isNull(plans.ownerAccountId),
        ),
      )
      .limit(1);

    if (!starterPlan) {
      throw new Error("Starter plan not found");
    }

    const [account] = await tx
      .insert(accounts)
      .values({ name: accountName })
      .returning({ id: accounts.id });

    if (!account) {
      throw new Error("Failed to create account");
    }

    await tx.insert(apiKeys).values({
      accountId: account.id,
      keyHash,
    });

    await tx.insert(planAssignments).values({
      planId: starterPlan.id,
      planType: "account",
      accountId: account.id,
    });

    return {
      accountId: account.id,
      apiKey,
    };
  });
}
