CREATE TABLE "email_verification_rate_limits" (
	"scope" text NOT NULL,
	"key_hash" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"last_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_rate_limits_scope_key_hash_window_start_pk" PRIMARY KEY("scope","key_hash","window_start")
);
--> statement-breakpoint
CREATE INDEX "email_verification_rate_window_idx" ON "email_verification_rate_limits" USING btree ("window_start");