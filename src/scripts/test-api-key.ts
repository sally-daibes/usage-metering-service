
import { getAccountIdFromApiKey } from "../modules/accounts/api-key.service.js";
import { pool } from "../db/client.js";

async function main() {
  const invalid = await getAccountIdFromApiKey("wrong-key");

  const unknown = await getAccountIdFromApiKey(
    `fts_${"0".repeat(64)}`
  );

  console.log("Invalid key rejected:", invalid === null);
  console.log("Unknown key rejected:", unknown === null);

  if (invalid !== null || unknown !== null) {
    throw new Error("Invalid API key test failed");
  }

  const savedKey = process.env.API_KEY;

  if (!savedKey) {
    console.log("Valid key test: SKIPPED");
    return;
  }

  const accountId = await getAccountIdFromApiKey(savedKey);

  if (accountId === null) {
    throw new Error("Valid API key test failed");
  }

  console.log("Valid key account ID:", accountId);
}

try {
  await main();
} catch (error) {
  console.error("Test failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
