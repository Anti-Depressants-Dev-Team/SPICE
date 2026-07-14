DROP INDEX IF EXISTS "remote_commands_pending_idx";--> statement-breakpoint
ALTER TABLE "remote_commands" ADD COLUMN "delivery_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "remote_devices" ADD COLUMN "paired_authorization_hash" text;--> statement-breakpoint
UPDATE "remote_commands" SET "delivery_attempts" = 3 WHERE "consumed_at" IS NOT NULL;--> statement-breakpoint
UPDATE "remote_devices" AS device
SET "paired_authorization_hash" = paired_auth."token_hash"
FROM "remote_device_authorizations" AS paired_auth
WHERE device."user_id" = paired_auth."user_id"
  AND device."device_id" = paired_auth."device_id";--> statement-breakpoint
CREATE INDEX "remote_commands_delivery_idx" ON "remote_commands" USING btree ("user_id","target_device_id","created_at") WHERE "remote_commands"."delivery_attempts" < 3;
