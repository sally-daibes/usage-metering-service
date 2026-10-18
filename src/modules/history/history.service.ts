
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "../../db/client.js";
import { requestHistory } from "../../db/schema.js";

export type HistoryFilters = {
  userId?: number;
  limit: number;
  offset: number;
};

export async function getAccountHistory(
  accountId: number,
  filters: HistoryFilters,
) {
  const { userId, limit, offset } = filters;

  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    throw new Error("Invalid account ID");
  }

  if (
    userId !== undefined &&
    (!Number.isSafeInteger(userId) || userId <= 0)
  ) {
    throw new Error("Invalid user ID");
  }

  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  ) {
    throw new Error("Invalid pagination");
  }

  // Always filter by the authenticated account.
  const condition =
    userId === undefined
      ? eq(requestHistory.accountId, accountId)
      : and(
          eq(requestHistory.accountId, accountId),
          eq(requestHistory.userId, userId),
        );

  // Count matching requests.
  const [countResult] = await db
    .select({
      total: sql<string>`COUNT(*)::text`,
    })
    .from(requestHistory)
    .where(condition);

  // Return the requested page, newest first.
  const items = await db
    .select({
      id: requestHistory.id,
      requestId: requestHistory.requestId,
      userId: requestHistory.userId,
      units: requestHistory.units,
      status: requestHistory.status,
      rejectionReason: requestHistory.rejectionReason,
      blockingLevel: requestHistory.blockingLevel,
      createdAt: requestHistory.createdAt,
    })
    .from(requestHistory)
    .where(condition)
    .orderBy(
      desc(requestHistory.createdAt),
      desc(requestHistory.id),
    )
    .limit(limit)
    .offset(offset);

  return {
    items,
    pagination: {
      total: Number(countResult?.total ?? "0"),
      limit,
      offset,
    },
  };
}
