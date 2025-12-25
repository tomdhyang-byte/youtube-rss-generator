/*
  Warnings:

  - The values [INVESTMENT,TECH_DEEP_DIVE,QUICK_DIGEST] on the enum `SummaryStyle` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SummaryStyle_new" AS ENUM ('DEFAULT', 'QUICK_READ');
ALTER TABLE "public"."episode_summaries" ALTER COLUMN "style" DROP DEFAULT;
ALTER TABLE "public"."podcast_subscriptions" ALTER COLUMN "summary_style" DROP DEFAULT;
ALTER TABLE "public"."video_summaries" ALTER COLUMN "style" DROP DEFAULT;
ALTER TABLE "public"."youtube_subscriptions" ALTER COLUMN "summary_style" DROP DEFAULT;
ALTER TABLE "video_summaries" ALTER COLUMN "style" TYPE "SummaryStyle_new" USING ("style"::text::"SummaryStyle_new");
ALTER TABLE "user_video_styles" ALTER COLUMN "style" TYPE "SummaryStyle_new" USING ("style"::text::"SummaryStyle_new");
ALTER TABLE "youtube_subscriptions" ALTER COLUMN "summary_style" TYPE "SummaryStyle_new" USING ("summary_style"::text::"SummaryStyle_new");
ALTER TABLE "episode_summaries" ALTER COLUMN "style" TYPE "SummaryStyle_new" USING ("style"::text::"SummaryStyle_new");
ALTER TABLE "user_episode_styles" ALTER COLUMN "style" TYPE "SummaryStyle_new" USING ("style"::text::"SummaryStyle_new");
ALTER TABLE "podcast_subscriptions" ALTER COLUMN "summary_style" TYPE "SummaryStyle_new" USING ("summary_style"::text::"SummaryStyle_new");
ALTER TYPE "SummaryStyle" RENAME TO "SummaryStyle_old";
ALTER TYPE "SummaryStyle_new" RENAME TO "SummaryStyle";
DROP TYPE "public"."SummaryStyle_old";
ALTER TABLE "episode_summaries" ALTER COLUMN "style" SET DEFAULT 'DEFAULT';
ALTER TABLE "podcast_subscriptions" ALTER COLUMN "summary_style" SET DEFAULT 'DEFAULT';
ALTER TABLE "video_summaries" ALTER COLUMN "style" SET DEFAULT 'DEFAULT';
ALTER TABLE "youtube_subscriptions" ALTER COLUMN "summary_style" SET DEFAULT 'DEFAULT';
COMMIT;
