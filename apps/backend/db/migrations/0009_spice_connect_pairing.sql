CREATE TABLE "remote_device_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"issuer_device_id" text NOT NULL,
	"device_id" text NOT NULL,
	"display_name" text DEFAULT 'Paired Spice Device' NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "remote_device_authorizations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "remote_pairing_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"issuer_device_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"consumed_by_device_id" text,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "remote_pairing_codes_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
ALTER TABLE "remote_device_authorizations" ADD CONSTRAINT "remote_device_authorizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remote_pairing_codes" ADD CONSTRAINT "remote_pairing_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "remote_device_authorizations_user_device_idx" ON "remote_device_authorizations" USING btree ("user_id","device_id");--> statement-breakpoint
CREATE INDEX "remote_device_authorizations_user_idx" ON "remote_device_authorizations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "remote_device_authorizations_expiry_idx" ON "remote_device_authorizations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "remote_pairing_codes_issuer_idx" ON "remote_pairing_codes" USING btree ("user_id","issuer_device_id");--> statement-breakpoint
CREATE INDEX "remote_pairing_codes_expiry_idx" ON "remote_pairing_codes" USING btree ("expires_at");