CREATE TYPE "public"."blocking_level" AS ENUM('account', 'user');--> statement-breakpoint
CREATE TYPE "public"."plan_type" AS ENUM('account', 'user');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" bigint NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "plan_assignments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"plan_id" bigint NOT NULL,
	"plan_type" "plan_type" NOT NULL,
	"account_id" bigint,
	"user_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "plan_assignments_target_check" CHECK ((
        (
          "plan_assignments"."plan_type" = 'account'
          AND "plan_assignments"."account_id" IS NOT NULL
          AND "plan_assignments"."user_id" IS NULL
        )
        OR
        (
          "plan_assignments"."plan_type" = 'user'
          AND "plan_assignments"."account_id" IS NULL
          AND "plan_assignments"."user_id" IS NOT NULL
        )
      )),
	CONSTRAINT "plan_assignments_dates_check" CHECK ("plan_assignments"."ended_at" IS NULL OR "plan_assignments"."ended_at" >= "plan_assignments"."created_at")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"plan_type" "plan_type" NOT NULL,
	"monthly_allowance" bigint NOT NULL,
	"max_units_per_request" bigint NOT NULL,
	"is_predefined" boolean NOT NULL,
	"owner_account_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_id_type_unique" UNIQUE("id","plan_type"),
	CONSTRAINT "plans_monthly_allowance_check" CHECK ("plans"."monthly_allowance" >= 0),
	CONSTRAINT "plans_max_units_check" CHECK ("plans"."max_units_per_request" > 0),
	CONSTRAINT "plans_ownership_check" CHECK ((
        ("plans"."is_predefined" = true AND "plans"."owner_account_id" IS NULL)
        OR
        ("plans"."is_predefined" = false AND "plans"."owner_account_id" IS NOT NULL)
      ))
);
--> statement-breakpoint
CREATE TABLE "request_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"request_id" varchar(255) NOT NULL,
	"units" bigint NOT NULL,
	"status" "request_status" NOT NULL,
	"rejection_reason" varchar(100),
	"blocking_level" "blocking_level",
	"decision_details" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_history_identity_unique" UNIQUE("id","account_id","user_id","units","status"),
	CONSTRAINT "request_history_units_check" CHECK ("request_history"."units" > 0),
	CONSTRAINT "request_history_decision_check" CHECK ((
        (
          "request_history"."status" = 'accepted'
          AND "request_history"."rejection_reason" IS NULL
          AND "request_history"."blocking_level" IS NULL
        )
        OR
        (
          "request_history"."status" = 'rejected'
          AND "request_history"."rejection_reason" IS NOT NULL
          AND "request_history"."blocking_level" IS NOT NULL
        )
      ))
);
--> statement-breakpoint
CREATE TABLE "usage_records" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"request_history_id" bigint NOT NULL,
	"units" bigint NOT NULL,
	"status" "request_status" DEFAULT 'accepted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_records_units_check" CHECK ("usage_records"."units" > 0),
	CONSTRAINT "usage_records_status_check" CHECK ("usage_records"."status" = 'accepted')
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" bigint NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_id_account_id_unique" UNIQUE("id","account_id")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_assignments" ADD CONSTRAINT "plan_assignments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_assignments" ADD CONSTRAINT "plan_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_assignments" ADD CONSTRAINT "plan_assignments_plan_type_fk" FOREIGN KEY ("plan_id","plan_type") REFERENCES "public"."plans"("id","plan_type") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_owner_account_id_accounts_id_fk" FOREIGN KEY ("owner_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_history" ADD CONSTRAINT "request_history_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_history" ADD CONSTRAINT "request_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_history" ADD CONSTRAINT "request_history_user_account_fk" FOREIGN KEY ("user_id","account_id") REFERENCES "public"."users"("id","account_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_request_identity_fk" FOREIGN KEY ("request_history_id","account_id","user_id","units","status") REFERENCES "public"."request_history"("id","account_id","user_id","units","status") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_key_hash_unique" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_keys_account_id_idx" ON "api_keys" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "active_account_plan_unique" ON "plan_assignments" USING btree ("account_id") WHERE "plan_assignments"."ended_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "active_user_plan_unique" ON "plan_assignments" USING btree ("user_id") WHERE "plan_assignments"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX "plan_assignments_plan_idx" ON "plan_assignments" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "request_history_account_request_unique" ON "request_history" USING btree ("account_id","request_id");--> statement-breakpoint
CREATE INDEX "request_history_account_created_idx" ON "request_history" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "request_history_user_created_idx" ON "request_history" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_records_request_history_unique" ON "usage_records" USING btree ("request_history_id");--> statement-breakpoint
CREATE INDEX "usage_records_account_created_idx" ON "usage_records" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_records_user_created_idx" ON "usage_records" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_account_external_id_unique" ON "users" USING btree ("account_id","external_id");