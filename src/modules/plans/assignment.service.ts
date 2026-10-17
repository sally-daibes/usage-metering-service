
import { and, eq, isNull, or, sql } from "drizzle-orm";

import { db } from "../../db/client.js";
import {
  users,
  plans,
  planAssignments,
} from "../../db/schema.js";

export async function assignPlanToUser(
  accountId: number,
  userId: number,
  planId: number,
) {
  if (
    !Number.isSafeInteger(accountId) ||
    accountId <= 0 ||
    !Number.isSafeInteger(userId) ||
    userId <= 0 ||
    !Number.isSafeInteger(planId) ||
    planId <= 0
  ) {
    throw new Error("Invalid assignment IDs");
  }

  return db.transaction(async (tx) => {
    // 1. Make sure the user belongs to this account.
    // Lock the user row to serialize plan changes.
    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.accountId, accountId),
        ),
      )
      .limit(1)
      .for("update");

    if (!user) {
      return { status: "user_not_found" as const };
    }

    // 2. The plan must be a user plan and either:
    //    - a predefined global plan, or
    //    - a custom plan owned by this account.
    const [plan] = await tx
      .select({
        id: plans.id,
        name: plans.name,
      })
      .from(plans)
      .where(
        and(
          eq(plans.id, planId),
          eq(plans.planType, "user"),
          or(
            and(
              eq(plans.isPredefined, true),
              isNull(plans.ownerAccountId),
            ),
            and(
              eq(plans.isPredefined, false),
              eq(plans.ownerAccountId, accountId),
            ),
          ),
        ),
      )
      .limit(1);

    if (!plan) {
      return { status: "plan_not_available" as const };
    }

    // 3. Find the user's currently active plan.
    const [current] = await tx
      .select({ planId: planAssignments.planId })
      .from(planAssignments)
      .where(
        and(
          eq(planAssignments.userId, userId),
          isNull(planAssignments.endedAt),
        ),
      )
      .limit(1);

    // No need to create another assignment
    // if the requested plan is already active.
    if (current?.planId === planId) {
      return {
        status: "unchanged" as const,
        userId,
        planId,
        planName: plan.name,
      };
    }

    // 4. End the previous assignment, if any.
    await tx
      .update(planAssignments)
      .set({
        endedAt: sql`GREATEST(
          clock_timestamp(),
          ${planAssignments.createdAt}
        )`,
      })
      .where(
        and(
          eq(planAssignments.userId, userId),
          isNull(planAssignments.endedAt),
        ),
      );

    // 5. Insert the new active assignment.
    await tx.insert(planAssignments).values({
  userId,
  planId,
  planType: "user",
  createdAt: sql`clock_timestamp()`,
});

    return {
      status: "assigned" as const,
      userId,
      planId,
      planName: plan.name,
    };
  });
}
