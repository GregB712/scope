DROP INDEX "newsrooms_owner_slug_key";--> statement-breakpoint
CREATE UNIQUE INDEX "newsrooms_slug_key" ON "newsrooms" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "newsrooms_owner_idx" ON "newsrooms" USING btree ("owner_id");