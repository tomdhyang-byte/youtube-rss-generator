# Personal YouTube RSS Generator - Architecture Overview

## 🎯 Project Purpose
A self-hosted web application that generates AI-summarized RSS feeds from YouTube channels and Podcasts. Users subscribe to channels/podcasts via a web interface, a background worker fetches content (video transcripts or audio transcripts), generates AI summaries, and serves them as RSS feeds.

---

## 📁 Project Structure

```
youtube-rss-generator/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Main UI (channel management)
│   ├── layout.tsx                # Root layout with theme provider
│   ├── globals.css               # Global styles (Tailwind)
│   ├── api/
│   │   ├── auth/[...nextauth]/   # NextAuth.js API routes
│   │   ├── channels/route.ts     # API: Add/list YouTube channels
│   │   ├── podcasts/route.ts     # API: Add/list Podcasts
│   │   └── subscriptions/        # API: Manage user subscriptions
│   └── feed/
│       ├── [channelId]/route.ts  # API: Generate YouTube RSS feed
│       └── podcast/
│           └── [podcastId]/route.ts # API: Generate Podcast RSS feed
│
├── components/                   # React components
│   ├── ChannelManager.tsx        # Channel list & add form
│   ├── AuthButton.tsx            # Login/Logout/Switch Account button
│   ├── ThemeProvider.tsx         # Dark mode context
│   └── ThemeToggle.tsx           # Dark mode toggle button
│
├── prisma/
│   └── schema.prisma             # Database schema (PostgreSQL)
│
├── lib/
│   ├── auth.ts                   # Auth helpers (getSession, isAdmin)
│   └── prisma.ts                 # Prisma Client singleton
│
├── middleware.ts                 # NextAuth middleware (protects routes)
├── worker.py                     # Python worker (fetch + summarize)
├── run_worker.sh                 # Shell script to run worker
├── requirements.txt              # Python dependencies
├── .env.example                  # Environment variable template
└── README.md                     # Setup guide
```

---

## 🔑 Key Files & Logic

### **Frontend (Next.js + React)**

#### `app/page.tsx`
- **Purpose**: Main entry point for the web interface
- **Logic**:
  - Handles authentication state (loading, unauthenticated, authenticated)
  - Fetches user subscriptions from `/api/subscriptions`
  - Renders `<ChannelManager>` with subscription data
  - Includes `<AuthButton>` for Google Sign-In

#### `components/ChannelManager.tsx`
- **Purpose**: UI for adding channels/podcasts and displaying subscriptions
- **Key Features**:
  - Input fields for YouTube channel and Podcast URLs
  - Calls `/api/channels` or `/api/podcasts` POST to add new content
  - Displays list of subscriptions with:
    - Title, description, last updated timestamp
    - Copy RSS link button
    - Unsubscribe button
  - **Quota Management**: Checks user quota (Admin vs Regular)
  - **Responsive**: Dark mode support, centered cards

#### `app/api/auth/[...nextauth]/route.ts`
- **Purpose**: NextAuth.js configuration
- **Providers**: Google OAuth
- **Adapter**: Prisma Adapter (stores users/sessions in DB)
- **Callbacks**: Custom session callback to include `user.id`

#### `middleware.ts`
- **Purpose**: Protects API routes
- **Logic**:
  - Public: `/feed/*`, `/_next/*`, `/favicon.ico`
  - Protected: `/api/channels`, `/api/podcasts`, `/api/subscriptions`

---

### **Backend (Python Worker)**

#### `worker.py`
- **Purpose**: Fetches new videos/episodes, generates AI summaries, saves to DB
- **Flow**:
  1. **Fetch Content**:
     - **YouTube**: Uses `scrapetube` to get latest 3 videos
     - **Podcast**: Uses `feedparser` to get latest 3 episodes
  2. **Fetch Transcript**:
     - **YouTube**: `YouTubeTranscriptApi.fetch()`
     - **Podcast**: `Deepgram API` (nova-2 model) for audio transcription
  3. **Generate Summary**: Calls OpenAI GPT-4o-mini with custom prompt (繁體中文)
     - **YouTube Prompt**: Focuses on visual content and key insights
     - **Podcast Prompt**: Focuses on dialogue, speakers, and key topics
  4. **Save to DB**: Inserts new content into `youtube_videos` or `podcast_episodes`
  5. **Rate Limiting**: Random delay 5-10 seconds to avoid IP bans
- **Database Access**: Uses raw SQL (`psycopg2`) with **snake_case** table names

---

## 🗄️ Database Schema (`prisma/schema.prisma`)

**Naming Convention**: `snake_case` for tables and columns in DB, `camelCase` in Prisma Client.

### **Auth Tables (NextAuth)**
- `users`: User profiles (name, email, image)
- `accounts`: OAuth provider links (Google)
- `sessions`: Login sessions
- `verification_tokens`: (Not used for OAuth but present)

### **Content Tables**

#### `youtube_channels`
```prisma
model YoutubeChannel {
  id           Int      @id @default(autoincrement())
  youtube_id   String   @unique
  title        String
  description  String?
  rss_url      String?
  last_updated DateTime @default(now())
  // Relations...
  @@map("youtube_channels")
}
```

#### `youtube_videos`
```prisma
model YoutubeVideo {
  id               Int            @id @default(autoincrement())
  youtube_video_id String         @unique
  channel_id       Int
  title            String
  summary          String
  published_at     DateTime
  // Relations...
  @@map("youtube_videos")
}
```

#### `podcast_channels` & `podcast_episodes`
Similar structure to YouTube tables, mapped to `podcast_channels` and `podcast_episodes`.

### **Subscription Tables**

#### `youtube_subscriptions`
```prisma
model YoutubeSubscription {
  id        Int      @id @default(autoincrement())
  userId    String   @map("user_id")
  channelId Int      @map("channel_id")
  createdAt DateTime @default(now()) @map("created_at")
  // Relations...
  @@unique([userId, channelId])
  @@map("youtube_subscriptions")
}
```

---

## 🔧 Environment Variables (`.env`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENAI_API_KEY` | OpenAI API key for GPT summaries |
| `DEEPGRAM_API_KEY` | Deepgram API key for Podcast transcription |
| `NEXTAUTH_URL` | Canonical URL of the site (e.g. https://your-domain.com) |
| `NEXTAUTH_SECRET` | Secret key for session encryption |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `ADMIN_EMAIL` | Email address for Admin privileges (Backend check) |
| `NEXT_PUBLIC_ADMIN_EMAIL` | Email address for Admin badge (Frontend check) |

---

## 🚀 Deployment & Execution

### **Web App (Vercel)**
- **Platform**: Vercel
- **Auto-deploy**: Pushes to GitHub `main` branch trigger deployments
- **Database**: PostgreSQL (Supabase/Neon)
- **Environment**: Requires all variables listed above to be set in Vercel Dashboard

### **Worker Automation**
- **Method**: Crontab on local machine or server
- **Example Schedule**:
  ```bash
  0 6,12,14,18,20,22 * * * cd /path/to/project && ./run_worker.sh >> cron_log.txt 2>&1
  ```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React, TypeScript |
| Styling | Tailwind CSS v4, Dark Mode |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth.js (Google OAuth) |
| Worker | Python 3.8+ |
| Transcript API | `youtube-transcript-api` (Video), Deepgram (Audio) |
| AI Summarizer | OpenAI GPT-4o-mini |
| RSS Generator | `rss` (npm) |

---

## 📝 Quick Start for New Contributors

1. **Clone & Install**:
   ```bash
   git clone <repo-url>
   cd youtube-rss-generator
   npm install
   pip install -r requirements.txt
   ```

2. **Setup Environment**:
   ```bash
   cp .env.example .env
   # Fill in all required variables
   ```

3. **Database Setup**:
   ```bash
   npx prisma generate
   # If starting fresh: npx prisma migrate dev
   ```

4. **Run Locally**:
   ```bash
   npm run dev              # Frontend at http://localhost:3000
   ./run_worker.sh          # Worker (run manually for testing)
   ```
