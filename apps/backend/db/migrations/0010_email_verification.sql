CREATE TABLE "email_verification_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"code_hash" text NOT NULL,
	"request_ip_hash" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"send_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
UPDATE "users" SET "email_verified_at" = now() WHERE "email_verified_at" IS NULL;--> statement-breakpoint
CREATE INDEX "email_verification_email_created_idx" ON "email_verification_challenges" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "email_verification_ip_created_idx" ON "email_verification_challenges" USING btree ("request_ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "email_verification_expiry_idx" ON "email_verification_challenges" USING btree ("expires_at");
