
import { createAccountWithKey } from "../modules/accounts/account.service.js";
import { pool } from "../db/client.js";

async function main() {
  const name = process.argv.slice(2).join(" ").trim();

  if (!name) {
    throw new Error("Please provide an account name");
  }

  const result = await createAccountWithKey(name);

  console.log("Account created successfully!");
  console.log("Account ID:", result.accountId);
  console.log("API Key:", result.apiKey);
  console.log("Save this key securely. It will not be shown again.");
}

try {
  await main();
} catch (error) {
  console.error("Failed to create account:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
