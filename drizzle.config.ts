import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const user = process.env.POSTGRES_USER;
const password = process.env.POSTGRES_PASSWORD;
const database = process.env.POSTGRES_DB;

if (!user || !password || !database) {
  throw new Error("Missing PostgreSQL environment variables");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",

  dbCredentials: {
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? "5433"),
    user,
    password,
    database,
  },
});
