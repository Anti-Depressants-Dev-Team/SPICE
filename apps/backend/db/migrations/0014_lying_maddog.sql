WITH "ranked_sessions" AS (
	SELECT "id", ROW_NUMBER() OVER (
		PARTITION BY "host_user_id"
		ORDER BY "updated_at" DESC, "id" DESC
	) AS "duplicate_rank"
	FROM "listen_together_sessions"
)
DELETE FROM "listen_together_sessions"
WHERE "id" IN (
	SELECT "id" FROM "ranked_sessions" WHERE "duplicate_rank" > 1
);--> statement-breakpoint
WITH "ranked_invites" AS (
	SELECT "id", ROW_NUMBER() OVER (
		PARTITION BY "session_id", "invited_user_id"
		ORDER BY "created_at" DESC, "id" DESC
	) AS "duplicate_rank"
	FROM "listen_together_invites"
)
DELETE FROM "listen_together_invites"
WHERE "id" IN (
	SELECT "id" FROM "ranked_invites" WHERE "duplicate_rank" > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX "listen_together_invites_session_user_unique" ON "listen_together_invites" USING btree ("session_id","invited_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "listen_together_sessions_host_user_unique" ON "listen_together_sessions" USING btree ("host_user_id");
