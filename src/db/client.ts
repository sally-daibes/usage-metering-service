
import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

const { Pool } = pg;

const user = process.env.POSTGRES_USER;
const password = process.env.POSTGRES_PASSWORD;
const database = process.env.POSTGRES_DB;

if (!user || !password || !database) {
  throw new Error("Missing PostgreSQL configuration");
}

const port = Number(process.env.DB_PORT ?? 5433);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("Invalid database port");
}

export const pool = new Pool({
  host: process.env.DB_HOST ?? "127.0.0.1",
  port,
  user,
  password,
  database,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle({
  client: pool,
  schema,
});
