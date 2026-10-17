
import {
  bigint,
  bigserial,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
  boolean,
  check,
  pgEnum,
  index,
  jsonb,
  foreignKey,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Accounts table
export const accounts = pgTable("accounts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),

  name: varchar("name", { length: 150 }).notNull(),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  }).notNull().defaultNow(),

  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  }).notNull().defaultNow(),
});

// Users table
export const users = pgTable(
  "users",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    accountId: bigint("account_id", {
      mode: "number",
    })
      .notNull()
      .references(() => accounts.id, {
        onDelete: "restrict",
      }),

    externalId: varchar("external_id", {
      length: 255,
    }).notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).notNull().defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).notNull().defaultNow(),
  },

(table) => [
  uniqueIndex("users_account_external_id_unique").on(
    table.accountId,
    table.externalId,
  ),

  unique("users_id_account_id_unique").on(
    table.id,
    table.accountId,
  ),
],
);

//Plans Table

export const planTypeEnum = pgEnum("plan_type", [
  "account",
  "user",
]);

export const plans = pgTable(
  "plans",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    name: varchar("name", { length: 100 }).notNull(),

    planType: planTypeEnum("plan_type").notNull(),

    monthlyAllowance: bigint("monthly_allowance", {
      mode: "number",
    }).notNull(),

    maxUnitsPerRequest: bigint("max_units_per_request", {
      mode: "number",
    }).notNull(),

    isPredefined: boolean("is_predefined").notNull(),

    ownerAccountId: bigint("owner_account_id", {
      mode: "number",
    }).references(() => accounts.id, {
      onDelete: "restrict",
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).notNull().defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).notNull().defaultNow(),
  },
  (table) => [

uniqueIndex("predefined_plan_name_type_unique")
  .on(table.planType, table.name)
  .where(sql`${table.isPredefined} = true`),

uniqueIndex("custom_plan_owner_name_type_unique")
  .on(table.ownerAccountId, table.planType, table.name)
  .where(sql`${table.isPredefined} = false`),

    unique("plans_id_type_unique").on(
  table.id,
  table.planType,
),
    check(
      "plans_monthly_allowance_check",
      sql`${table.monthlyAllowance} >= 0`,
    ),
    check(
      "plans_max_units_check",
      sql`${table.maxUnitsPerRequest} > 0`,
    ),
    check(
      "plans_ownership_check",
      sql`(
        (${table.isPredefined} = true AND ${table.ownerAccountId} IS NULL)
        OR
        (${table.isPredefined} = false AND ${table.ownerAccountId} IS NOT NULL)
      )`,
    ),
  ],
);


//API Keys
export const apiKeys = pgTable(
  "api_keys",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    accountId: bigint("account_id", {
      mode: "number",
    })
      .notNull()
      .references(() => accounts.id, {
        onDelete: "restrict",
      }),

    keyHash: varchar("key_hash", {
      length: 64,
    }).notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).notNull().defaultNow(),

    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
    }),
  },
  (table) => [
    uniqueIndex("api_keys_key_hash_unique").on(
      table.keyHash,
    ),

    index("api_keys_account_id_idx").on(
      table.accountId,
    ),
  ],
);

//plan_assignments table


export const planAssignments = pgTable(
  "plan_assignments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    planId: bigint("plan_id", {
      mode: "number",
    }).notNull(),

    planType: planTypeEnum("plan_type").notNull(),

    accountId: bigint("account_id", {
      mode: "number",
    }).references(() => accounts.id, {
      onDelete: "restrict",
    }),

    userId: bigint("user_id", {
      mode: "number",
    }).references(() => users.id, {
      onDelete: "restrict",
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).notNull().defaultNow(),

    endedAt: timestamp("ended_at", {
      withTimezone: true,
    }),
  },
  (table) => [
    foreignKey({
      name: "plan_assignments_plan_type_fk",
      columns: [table.planId, table.planType],
      foreignColumns: [plans.id, plans.planType],
    }).onDelete("restrict"),

    check(
      "plan_assignments_target_check",
      sql`(
        (
          ${table.planType} = 'account'
          AND ${table.accountId} IS NOT NULL
          AND ${table.userId} IS NULL
        )
        OR
        (
          ${table.planType} = 'user'
          AND ${table.accountId} IS NULL
          AND ${table.userId} IS NOT NULL
        )
      )`,
    ),

    check(
      "plan_assignments_dates_check",
      sql`${table.endedAt} IS NULL OR ${table.endedAt} >= ${table.createdAt}`,
    ),

    uniqueIndex("active_account_plan_unique")
      .on(table.accountId)
      .where(sql`${table.endedAt} IS NULL`),

    uniqueIndex("active_user_plan_unique")
      .on(table.userId)
      .where(sql`${table.endedAt} IS NULL`),

    index("plan_assignments_plan_idx").on(table.planId),
  ],
);


//request_history table
export const requestStatusEnum = pgEnum(
  "request_status",
  ["accepted", "rejected"],
);

export const blockingLevelEnum = pgEnum(
  "blocking_level",
  ["account", "user"],
);

export const requestHistory = pgTable(
  "request_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    accountId: bigint("account_id", {
      mode: "number",
    })
      .notNull()
      .references(() => accounts.id, {
        onDelete: "restrict",
      }),

    userId: bigint("user_id", {
      mode: "number",
    })
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
      }),

    requestId: varchar("request_id", {
      length: 255,
    }).notNull(),

    units: bigint("units", {
      mode: "number",
    }).notNull(),

    status: requestStatusEnum("status").notNull(),

    rejectionReason: varchar("rejection_reason", {
      length: 100,
    }),

    blockingLevel: blockingLevelEnum("blocking_level"),

    decisionDetails: jsonb("decision_details")
      .$type<Record<string, unknown>>()
      .notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).notNull().defaultNow(),
  },

  (table) => [
    foreignKey({
      name: "request_history_user_account_fk",
      columns: [table.userId, table.accountId],
      foreignColumns: [users.id, users.accountId],
    }).onDelete("restrict"),

    unique("request_history_identity_unique").on(
      table.id,
      table.accountId,
      table.userId,
      table.units,
      table.status,
    ),

    uniqueIndex("request_history_account_request_unique")
      .on(table.accountId, table.requestId),


    index("request_history_account_created_idx")
      .on(table.accountId, table.createdAt),

    index("request_history_user_created_idx")
      .on(table.userId, table.createdAt),

    check(
      "request_history_units_check",
      sql`${table.units} > 0`,
    ),

    check(
      "request_history_decision_check",
      sql`(
        (
          ${table.status} = 'accepted'
          AND ${table.rejectionReason} IS NULL
          AND ${table.blockingLevel} IS NULL
        )
        OR
        (
          ${table.status} = 'rejected'
          AND ${table.rejectionReason} IS NOT NULL
          AND ${table.blockingLevel} IS NOT NULL
        )
      )`,
    ),
  ],
);

//requestHistory table


export const usageRecords = pgTable(
  "usage_records",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    accountId: bigint("account_id", {
      mode: "number",
    }).notNull(),

    userId: bigint("user_id", {
      mode: "number",
    }).notNull(),

    requestHistoryId: bigint("request_history_id", {
      mode: "number",
    }).notNull(),

    units: bigint("units", {
      mode: "number",
    }).notNull(),

    status: requestStatusEnum("status")
      .notNull()
      .default("accepted"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "usage_records_request_identity_fk",
      columns: [
        table.requestHistoryId,
        table.accountId,
        table.userId,
        table.units,
        table.status,
      ],
      foreignColumns: [
        requestHistory.id,
        requestHistory.accountId,
        requestHistory.userId,
        requestHistory.units,
        requestHistory.status,
      ],
    }).onDelete("restrict"),

    uniqueIndex("usage_records_request_history_unique")
      .on(table.requestHistoryId),

    index("usage_records_account_created_idx")
      .on(table.accountId, table.createdAt),

    index("usage_records_user_created_idx")
      .on(table.userId, table.createdAt),

    check(
      "usage_records_units_check",
      sql`${table.units} > 0`,
    ),

    check(
      "usage_records_status_check",
      sql`${table.status} = 'accepted'`,
    ),
  ],
);
