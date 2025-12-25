-- CreateEnum
CREATE TYPE "SummaryStyle" AS ENUM ('DEFAULT', 'INVESTMENT', 'TECH_DEEP_DIVE', 'QUICK_DIGEST');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "QueueType" AS ENUM ('YOUTUBE', 'PODCAST');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "email_verified" TIMESTAMP(3),
    "image" TEXT,
    "feed_token" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "youtube_channels" (
    "id" SERIAL NOT NULL,
    "youtube_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "rss_url" TEXT,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "youtube_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "youtube_videos" (
    "id" SERIAL NOT NULL,
    "youtube_video_id" TEXT NOT NULL,
    "channel_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "transcript" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "youtube_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_summaries" (
    "id" SERIAL NOT NULL,
    "video_id" INTEGER NOT NULL,
    "style" "SummaryStyle" NOT NULL DEFAULT 'DEFAULT',
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_video_styles" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "video_id" INTEGER NOT NULL,
    "style" "SummaryStyle" NOT NULL,

    CONSTRAINT "user_video_styles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "youtube_subscriptions" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel_id" INTEGER NOT NULL,
    "summary_style" "SummaryStyle" NOT NULL DEFAULT 'DEFAULT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "youtube_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "podcast_channels" (
    "id" SERIAL NOT NULL,
    "feed_url" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "site_url" TEXT,
    "image_url" TEXT,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "podcast_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "podcast_episodes" (
    "id" SERIAL NOT NULL,
    "podcast_id" INTEGER NOT NULL,
    "guid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "audio_url" TEXT NOT NULL,
    "transcript" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "podcast_episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episode_summaries" (
    "id" SERIAL NOT NULL,
    "episode_id" INTEGER NOT NULL,
    "style" "SummaryStyle" NOT NULL DEFAULT 'DEFAULT',
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "episode_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_episode_styles" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "episode_id" INTEGER NOT NULL,
    "style" "SummaryStyle" NOT NULL,

    CONSTRAINT "user_episode_styles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "podcast_subscriptions" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "podcast_id" INTEGER NOT NULL,
    "summary_style" "SummaryStyle" NOT NULL DEFAULT 'DEFAULT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "podcast_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_queue" (
    "id" SERIAL NOT NULL,
    "type" "QueueType" NOT NULL,
    "entityId" INTEGER NOT NULL,
    "status" "QueueStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processing_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_feed_token_key" ON "users"("feed_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "youtube_channels_youtube_id_key" ON "youtube_channels"("youtube_id");

-- CreateIndex
CREATE UNIQUE INDEX "youtube_videos_youtube_video_id_key" ON "youtube_videos"("youtube_video_id");

-- CreateIndex
CREATE UNIQUE INDEX "video_summaries_video_id_style_key" ON "video_summaries"("video_id", "style");

-- CreateIndex
CREATE INDEX "user_video_styles_user_id_idx" ON "user_video_styles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_video_styles_user_id_video_id_key" ON "user_video_styles"("user_id", "video_id");

-- CreateIndex
CREATE INDEX "youtube_subscriptions_channel_id_summary_style_idx" ON "youtube_subscriptions"("channel_id", "summary_style");

-- CreateIndex
CREATE UNIQUE INDEX "youtube_subscriptions_user_id_channel_id_key" ON "youtube_subscriptions"("user_id", "channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "podcast_channels_feed_url_key" ON "podcast_channels"("feed_url");

-- CreateIndex
CREATE UNIQUE INDEX "podcast_episodes_podcast_id_guid_key" ON "podcast_episodes"("podcast_id", "guid");

-- CreateIndex
CREATE UNIQUE INDEX "episode_summaries_episode_id_style_key" ON "episode_summaries"("episode_id", "style");

-- CreateIndex
CREATE INDEX "user_episode_styles_user_id_idx" ON "user_episode_styles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_episode_styles_user_id_episode_id_key" ON "user_episode_styles"("user_id", "episode_id");

-- CreateIndex
CREATE INDEX "podcast_subscriptions_podcast_id_summary_style_idx" ON "podcast_subscriptions"("podcast_id", "summary_style");

-- CreateIndex
CREATE UNIQUE INDEX "podcast_subscriptions_user_id_podcast_id_key" ON "podcast_subscriptions"("user_id", "podcast_id");

-- CreateIndex
CREATE INDEX "processing_queue_status_createdAt_idx" ON "processing_queue"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "youtube_videos" ADD CONSTRAINT "youtube_videos_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "youtube_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_summaries" ADD CONSTRAINT "video_summaries_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "youtube_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_video_styles" ADD CONSTRAINT "user_video_styles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_video_styles" ADD CONSTRAINT "user_video_styles_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "youtube_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "youtube_subscriptions" ADD CONSTRAINT "youtube_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "youtube_subscriptions" ADD CONSTRAINT "youtube_subscriptions_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "youtube_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "podcast_episodes" ADD CONSTRAINT "podcast_episodes_podcast_id_fkey" FOREIGN KEY ("podcast_id") REFERENCES "podcast_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episode_summaries" ADD CONSTRAINT "episode_summaries_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "podcast_episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_episode_styles" ADD CONSTRAINT "user_episode_styles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_episode_styles" ADD CONSTRAINT "user_episode_styles_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "podcast_episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "podcast_subscriptions" ADD CONSTRAINT "podcast_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "podcast_subscriptions" ADD CONSTRAINT "podcast_subscriptions_podcast_id_fkey" FOREIGN KEY ("podcast_id") REFERENCES "podcast_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
