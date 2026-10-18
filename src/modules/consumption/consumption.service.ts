
import {
  and,
  eq,
  gte,
  isNull,
  lt,
  sql,
} from "drizzle-orm";

import { db } from "../../db/client.js";

import {
  accounts,
  users,
  plans,
  planAssignments,
  requestHistory,
  usageRecords,
} from "../../db/schema.js";

export type ConsumptionDecision = {
  requestId: string;
  accountId: number;
  userId: number;
  units: number;
  status: "accepted" | "rejected";
  rejectionReason: string | null;
  blockingLevel: "account" | "user" | null;
  accountMonthlyUsed: string;
  userMonthlyUsed: string;
};

export async function consumeUnits(
  accountId: number,
  userId: number,
  requestIdInput: string,
  units: number,
) {
  const requestId = requestIdInput.trim();

  if (
    !Number.isSafeInteger(accountId) ||
    accountId <= 0 ||
    !Number.isSafeInteger(userId) ||
    userId <= 0 ||
    !Number.isSafeInteger(units) ||
    units <= 0 ||
    !requestId ||
    requestId.length > 255
  ) {
    throw new Error("Invalid consumption input");
  }

  return db.transaction(async (tx) => {
    // Lock the account to serialize consumption requests.
    const [account] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .for("update");

    if (!account) {
      return { kind: "not_found" as const };
    }

    // A request ID is unique inside an account.
    const [previous] = await tx
      .select()
      .from(requestHistory)
      .where(
        and(
          eq(requestHistory.accountId, accountId),
          eq(requestHistory.requestId, requestId),
        ),
      )
      .limit(1);

    if (previous) {
      if (
        previous.userId !== userId ||
        previous.units !== units
      ) {
        return { kind: "conflict" as const };
      }

      return {
        kind: "decision" as const,
        replayed: true,
        decision: previous.decisionDetails as unknown as ConsumptionDecision,
      };
    }

    // The user must belong to this account.
    // Lock the user while reading their active plan.
    const [user] = await tx
      .select({
        id: users.id,
        decisionTime: sql<Date>`clock_timestamp()`,
      })
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.accountId, accountId),
        ),
      )
      .for("update");

    if (!user) {
      return { kind: "not_found" as const };
    }

    // Read the account's active plan.
    const [accountPlan] = await tx
      .select({
        monthlyAllowance: plans.monthlyAllowance,
        maxUnitsPerRequest: plans.maxUnitsPerRequest,
      })
      .from(planAssignments)
      .innerJoin(
        plans,
        eq(planAssignments.planId, plans.id),
      )
      .where(
        and(
          eq(planAssignments.accountId, accountId),
          eq(planAssignments.planType, "account"),
          isNull(planAssignments.endedAt),
        ),
      )
      .limit(1);

    // Read the user's active plan.
    const [userPlan] = await tx
      .select({
        monthlyAllowance: plans.monthlyAllowance,
        maxUnitsPerRequest: plans.maxUnitsPerRequest,
      })
      .from(planAssignments)
      .innerJoin(
        plans,
        eq(planAssignments.planId, plans.id),
      )
      .where(
        and(
          eq(planAssignments.userId, userId),
          eq(planAssignments.planType, "user"),
          isNull(planAssignments.endedAt),
        ),
      )
      .limit(1);

    if (!accountPlan || !userPlan) {
      throw new Error("Active plan is missing");
    }

    // UTC calendar-month boundaries.

const rawDecisionTime: unknown = user.decisionTime;

const decisionTime =
  rawDecisionTime instanceof Date
    ? rawDecisionTime
    : new Date(String(rawDecisionTime));

if (Number.isNaN(decisionTime.getTime())) {
  throw new Error("Invalid decision timestamp");
}


    const monthStart = new Date(
      Date.UTC(
        decisionTime.getUTCFullYear(),
        decisionTime.getUTCMonth(),
        1,
      ),
    );

    const nextMonthStart = new Date(
      Date.UTC(
        decisionTime.getUTCFullYear(),
        decisionTime.getUTCMonth() + 1,
        1,
      ),
    );

    // Count accepted usage only.
    // PostgreSQL BIGINT sums are handled as BigInt.
    const [usage] = await tx
      .select({
        accountTotal: sql<string>`
          COALESCE(SUM(${usageRecords.units}), 0)::text
        `,
        userTotal: sql<string>`
          COALESCE(
            SUM(${usageRecords.units}) FILTER (
              WHERE ${usageRecords.userId} = ${userId}
            ),
            0
          )::text
        `,
      })
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.accountId, accountId),
          gte(usageRecords.createdAt, monthStart),
          lt(usageRecords.createdAt, nextMonthStart),
        ),
      );

    const accountUsed = BigInt(usage?.accountTotal ?? "0");
    const userUsed = BigInt(usage?.userTotal ?? "0");
    const requested = BigInt(units);

    let rejectionReason: string | null = null;
    let blockingLevel: "account" | "user" | null = null;

    // Check account-level limits first.
    if (
      requested > BigInt(accountPlan.maxUnitsPerRequest)
    ) {
      rejectionReason = "ACCOUNT_REQUEST_LIMIT_EXCEEDED";
      blockingLevel = "account";
    } else if (
      requested > BigInt(userPlan.maxUnitsPerRequest)
    ) {
      rejectionReason = "USER_REQUEST_LIMIT_EXCEEDED";
      blockingLevel = "user";
    } else if (
      accountUsed + requested >
      BigInt(accountPlan.monthlyAllowance)
    ) {
      rejectionReason = "ACCOUNT_MONTHLY_LIMIT_EXCEEDED";
      blockingLevel = "account";
    } else if (
      userUsed + requested >
      BigInt(userPlan.monthlyAllowance)
    ) {
      rejectionReason = "USER_MONTHLY_LIMIT_EXCEEDED";
      blockingLevel = "user";
    }

    const status =
      rejectionReason === null
        ? ("accepted" as const)
        : ("rejected" as const);

    const chargedUnits =
      status === "accepted" ? requested : 0n;

    const decision: ConsumptionDecision = {
      requestId,
      accountId,
      userId,
      units,
      status,
      rejectionReason,
      blockingLevel,
      accountMonthlyUsed: (
        accountUsed + chargedUnits
      ).toString(),
      userMonthlyUsed: (
        userUsed + chargedUnits
      ).toString(),
    };

    // Every decision is saved in request history.
    const [history] = await tx
      .insert(requestHistory)
      .values({
        accountId,
        userId,
        requestId,
        units,
        status,
        rejectionReason,
        blockingLevel,
        decisionDetails: { ...decision },
        createdAt: decisionTime,
      })
      .returning({ id: requestHistory.id });

    if (!history) {
      throw new Error("Failed to save request history");
    }

    // Only accepted requests create actual usage.
    if (status === "accepted") {
      await tx.insert(usageRecords).values({
        accountId,
        userId,
        requestHistoryId: history.id,
        units,
        status: "accepted",
        createdAt: decisionTime,
      });
    }

    return {
      kind: "decision" as const,
      replayed: false,
      decision,
    };
  });
}
