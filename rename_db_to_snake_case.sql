-- ===============================================================
-- Rename Tables and Columns to Snake Case
-- Run this script to rename existing tables/columns in the database
-- ===============================================================

-- 1. Rename Tables
ALTER TABLE IF EXISTS "Account" RENAME TO "accounts";
ALTER TABLE IF EXISTS "Session" RENAME TO "sessions";
ALTER TABLE IF EXISTS "User" RENAME TO "users";
ALTER TABLE IF EXISTS "VerificationToken" RENAME TO "verification_tokens";
ALTER TABLE IF EXISTS "YoutubeChannel" RENAME TO "youtube_channels";
ALTER TABLE IF EXISTS "YoutubeVideo" RENAME TO "youtube_videos";
ALTER TABLE IF EXISTS "YoutubeSubscription" RENAME TO "youtube_subscriptions";
ALTER TABLE IF EXISTS "PodcastChannel" RENAME TO "podcast_channels";
ALTER TABLE IF EXISTS "PodcastEpisode" RENAME TO "podcast_episodes";
ALTER TABLE IF EXISTS "PodcastSubscription" RENAME TO "podcast_subscriptions";

-- 2. Rename Columns (CamelCase -> snake_case)

-- accounts
ALTER TABLE "accounts" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "accounts" RENAME COLUMN "providerAccountId" TO "provider_account_id";

-- sessions
ALTER TABLE "sessions" RENAME COLUMN "sessionToken" TO "session_token";
ALTER TABLE "sessions" RENAME COLUMN "userId" TO "user_id";

-- users
ALTER TABLE "users" RENAME COLUMN "emailVerified" TO "email_verified";

-- youtube_subscriptions
ALTER TABLE "youtube_subscriptions" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "youtube_subscriptions" RENAME COLUMN "channelId" TO "channel_id";
ALTER TABLE "youtube_subscriptions" RENAME COLUMN "createdAt" TO "created_at";

-- podcast_subscriptions
ALTER TABLE "podcast_subscriptions" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "podcast_subscriptions" RENAME COLUMN "podcastId" TO "podcast_id";
ALTER TABLE "podcast_subscriptions" RENAME COLUMN "createdAt" TO "created_at";

-- ===============================================================
-- Optional: Rename Indexes and Constraints to match convention
-- (Prisma might expect specific names, but usually adapts)
-- ===============================================================

-- Example: ALTER INDEX "User_email_key" RENAME TO "users_email_key";
-- You can run this if you want strict naming consistency for indexes too.
