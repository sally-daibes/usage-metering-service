import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.js";

try {
  console.log("Running database migrations...");

  await migrate(db, {
    migrationsFolder: "./drizzle",
  });

  console.log("Database migrations completed successfully.");
} catch (error) {
  console.error("Database migration failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
