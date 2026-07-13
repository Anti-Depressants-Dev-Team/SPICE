DELETE FROM "remote_commands" WHERE "consumed_at" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remote_commands_pending_idx" ON "remote_commands" USING btree ("user_id","target_device_id","created_at") WHERE "remote_commands"."consumed_at" IS NULL;
