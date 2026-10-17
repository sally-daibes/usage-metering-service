
import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "../../db/client.js";
import { apiKeys } from "../../db/schema.js";

export async function getAccountIdFromApiKey(
  apiKey: string | undefined,
): Promise<number | null> {

  if (!apiKey || !/^fts_[0-9a-f]{64}$/.test(apiKey)) {
    return null;
  }

  const keyHash = createHash("sha256")
    .update(apiKey)
    .digest("hex");

  const [record] = await db
    .select({ accountId: apiKeys.accountId })
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.keyHash, keyHash),
        isNull(apiKeys.revokedAt),
      ),
    )
    .limit(1);

  return record?.accountId ?? null;
}
