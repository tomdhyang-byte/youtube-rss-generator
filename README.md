# Personal YouTube RSS Generator

> **AI Context**: This project is a hybrid Next.js (Frontend/API) and Python (Worker) application designed to generate RSS feeds with AI summaries for YouTube channels and Podcasts. It also includes a **Web Reader** for reading summaries directly on the website.

## 🏗 Architecture Overview

-   **Frontend**: Next.js 14 (App Router), Tailwind CSS, Lucide React.
-   **Backend**: Next.js API Routes (for UI interactions), Python Worker (for heavy lifting).
-   **Database**: PostgreSQL (Supabase) accessed via Prisma (Next.js) and `pg8000` (Python).
-   **AI**: OpenAI GPT-4.1 for summarization, Supadata for YouTube transcripts, Deepgram for podcast transcription.
-   **Authentication**: NextAuth.js (Google Provider).

---

## 🌐 Web Reader Feature (NEW)

The application now includes a web-based feed reader for consuming AI summaries directly on the website.

### Pages

| Route | Description |
|-------|-------------|
| `/` | Landing Page - "Try it Free" CTA for unauthenticated users |
| `/feed` | Feed Timeline - View all subscribed content with filters (All/YouTube/Podcasts) |
| `/subscriptions` | Subscription Management - Add/remove channels and podcasts |
| `/video/[id]` | Video Summary Page - AI summary with embedded YouTube player |
| `/episode/[id]` | Episode Summary Page - AI summary with audio player |

### Components

| Component | Description |
|-----------|-------------|
| `TopNav.tsx` | Global navigation with Logo, Feed/Subscriptions tabs, Quota Badge, UserMenu |
| `FeedCard.tsx` | Content card for feed timeline (thumbnail, title, source, summary preview) |

### User Flow

```
Landing (/) ──[Try it Free]──> Google Login ──> Feed (/feed)
                                                   │
                                    ┌──────────────┴──────────────┐
                                    ▼                             ▼
                             Empty State                    Has Content
                             (Add forms)                    (Timeline)
                                    │                             │
                                    │                       [Click Card] (Modal)
                                    │                             │
                                    └──────[Subscriptions tab]────┘
                                                   ▼
                                          Subscriptions (/subscriptions)
```

### Key Improvements (v2)

#### 1. Instant Article Modal
- **Zero-Latency Opening**: Feeds are pre-loaded with all necessary data (video IDs, audio URLs). Clicking an item opens the modal instantly (0ms) without fetching additional data.
- **Context Preservation**: Reading happens in an overlay, preserving the scroll position of the feed list.

#### 2. Read Status Tracking
- **Visual Distinction**: Unread items have a distinct orange left border and full opacity. Read items fade to 60% opacity.
- **Local Persistence**: Read status is stored locally (`localStorage`) for privacy and speed.
- **Auto-Mark**: Items are automatically marked as read when clicked.

---

## 📁 Project Structure

```
youtube-rss-generator/
├── app/                          # Next.js App Router
│   ├── api/                      #   API Routes
│   │   ├── channels/             #     YouTube channel CRUD
│   │   ├── podcasts/             #     Podcast CRUD
│   │   ├── subscriptions/        #     User subscriptions
│   │   ├── feed/                 #     Feed timeline API
│   │   ├── article/              #     🆕 Article content API (Modal)
│   │   └── auth/                 #     NextAuth endpoints
│   ├── feed/                     #   Web Reader Feed page + RSS routes
│   │   ├── page.tsx              #     Feed timeline UI
│   │   ├── [channelId]/          #     YouTube RSS feed endpoint
│   │   └── podcast/[podcastId]/  #     Podcast RSS feed endpoint
│   ├── subscriptions/            #   🆕 Subscription management page
│   ├── video/[videoId]/          #   YouTube video summary pages
│   ├── episode/[episodeId]/      #   Podcast episode summary pages
│   ├── page.tsx                  #   🆕 Landing page
│   └── layout.tsx                #   Root layout
│
├── components/                   # React Components
│   ├── TopNav.tsx                #   🆕 Global navigation bar
│   ├── FeedCard.tsx              #   🆕 Feed item card
│   ├── ChannelManager/           #   Subscription manager (used in /subscriptions)
│   │   ├── index.tsx             #     Main component (tabs, state)
│   │   ├── AddChannelForm.tsx    #     URL input form
│   │   ├── ChannelCard.tsx       #     YouTube channel card
│   │   ├── PodcastCard.tsx       #     Podcast card
│   │   └── types.ts              #     TypeScript interfaces
│   ├── UserMenu.tsx              #   User dropdown (Switch Account, Sign Out)
│   ├── LoginModal.tsx            #   Login dialog
│   └── ui/                       #   Shared UI components
│
├── lib/                          # Shared utilities
│   ├── prisma.ts                 #   Prisma client (configured for PgBouncer)
│   ├── auth.ts                   #   Auth configuration
│   ├── types.ts                  #   TypeScript types
│   └── hooks/                    #   Custom React hooks
│       ├── useLocalStorage.ts    #     LocalStorage hook
│       └── useGuestSync.ts       #     Guest → User sync
│
├── prisma/
│   └── schema.prisma             # Database schema (PostgreSQL)
│
├── worker/                       # Python Worker Package (Modularized)
│   ├── __init__.py               #   Main entry (main function)
│   ├── config.py                 #   Environment variables & validation
│   ├── db.py                     #   Database connection (pg8000)
│   ├── transcribe.py             #   Transcript APIs (Supadata, Deepgram)
│   ├── summarize.py              #   OpenAI summarization + prompts
│   ├── youtube.py                #   YouTube channel processing
│   └── podcast.py                #   Podcast episode processing
│
├── worker.py                     # Worker entry point (imports worker/)
├── run_worker.sh                 # Wrapper script (env + logging)
├── requirements.txt              # Python dependencies
└── package.json                  # Node.js dependencies
```

---

## 🐍 Worker Module Details

The Python worker is organized into focused modules for maintainability:

| Module | Responsibility |
|--------|----------------|
| `config.py` | Loads environment variables, validates required API keys |
| `db.py` | PostgreSQL connection via `pg8000`, `fetch_as_dict()` utility |
| `transcribe.py` | `fetch_supadata_transcript()` for YouTube, `transcribe_audio()` for podcasts |
| `summarize.py` | OpenAI GPT-4.1 calls with YouTube/Podcast-specific prompts (lazy-loaded client) |
| `youtube.py` | Fetches videos via `scrapetube`, checks duplicates, orchestrates transcript → summary |
| `podcast.py` | Parses RSS via `feedparser`, orchestrates transcription → summary |
| `__init__.py` | `main()` function that coordinates all channels with active subscriptions |

### Worker Flow
```
main()
  ├─ validate_config()          # Check env vars
  ├─ get_db_connection()        # Connect to PostgreSQL
  ├─ Query channels with subscriptions (JOIN youtube_subscriptions)
  ├─ For each channel:
  │   ├─ scrapetube.get_channel() → latest 3 videos
  │   ├─ Skip if video exists in DB
  │   ├─ fetch_supadata_transcript(video_id)
  │   ├─ generate_summary(transcript)
  │   └─ INSERT INTO youtube_videos
  └─ Same flow for podcasts (feedparser → Deepgram → summary)
```

---

## 🎨 ChannelManager Component Details

The React frontend's main component is also modularized:

| Component | Responsibility |
|-----------|----------------|
| `index.tsx` | Main component: tabs, form state, API calls, optimistic updates |
| `AddChannelForm.tsx` | Reusable form for YouTube/Podcast URL input with validation |
| `ChannelCard.tsx` | Displays YouTube channel with unsubscribe, copy RSS, external link buttons |
| `PodcastCard.tsx` | Displays Podcast with same action buttons |
| `types.ts` | Shared TypeScript interfaces (`YoutubeChannel`, `PodcastChannel`, etc.) |

### Key Features
- **Guest Mode**: Non-authenticated users can add 1 channel (stored in localStorage)
- **Optimistic UI**: Deletions happen immediately, then sync with backend
- **Backward Compatible**: `ChannelManager.tsx` re-exports for existing imports

---

## 📡 RSS Feed Behavior

RSS feeds are designed for maximum compatibility with various RSS readers, including Readwise Reader.

### Summary Pages

Each video/episode has a dedicated summary page that displays the AI-generated summary with embedded media:

| Type | URL Pattern | Content |
|------|-------------|---------|
| YouTube | `/video/[videoId]` | AI summary + embedded YouTube player |
| Podcast | `/episode/[episodeId]` | AI summary + audio player |

### Feed Structure

RSS `<link>` elements point to our summary pages (not the original source) to ensure readers display our AI summaries:

```xml
<!-- YouTube -->
<link>https://your-domain.vercel.app/video/R7i9KdVTFR4</link>

<!-- Podcast (keeps <enclosure> for podcast apps) -->
<link>https://your-domain.vercel.app/episode/18</link>
<enclosure url="https://original-podcast.mp3" type="audio/mpeg"/>
```

This prevents readers like Readwise Reader from fetching content directly from YouTube/Podcast sources.

---

## 🚀 Quick Start

### 1. Prerequisites
-   Node.js (v18+)
-   Python (v3.8+)
-   PostgreSQL Database (Supabase recommended)
-   OpenAI API Key
-   Supadata API Key (for YouTube transcripts)
-   Deepgram API Key (optional, for podcasts)

### 2. Installation
```bash
# Clone
git clone <repo-url>
cd youtube-rss-generator

# Frontend
npm install

# Backend
pip install -r requirements.txt
```

### 3. Configuration (`.env`)
Create a `.env` file with the following keys:

```env
# Database (Supabase Transaction Pooler - Port 6543)
DATABASE_URL="postgresql://user:pass@host:6543/db?pgbouncer=true"

# Direct Connection (Supabase Session Pooler - Port 5432 - For Migrations/Worker)
DIRECT_URL="postgresql://user:pass@host:5432/db"

# AI Services
OPENAI_API_KEY="sk-..."
SUPADATA_API_KEY="..."
DEEPGRAM_API_KEY="..."

# Auth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<random-string>"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Admin
ADMIN_EMAIL="your-email@gmail.com"
NEXT_PUBLIC_ADMIN_EMAIL="your-email@gmail.com"
```

### 4. Database Setup
```bash
npx prisma migrate dev
```

---

## 🏃‍♂️ Running the Application

### Frontend (Web UI)
```bash
npm run dev
# Access at http://localhost:3000
```

### Background Worker (Python)
The worker fetches new videos/episodes, downloads transcripts, and generates summaries.

**Manual Run:**
```bash
./run_worker.sh
# Or directly:
python worker.py
```

**Automated Run (Cron):**
```bash
# Run every hour
0 * * * * /path/to/youtube-rss-generator/run_worker.sh
```

---

## 🔄 Multi-Device Workflow

This project is often developed on a **MacBook Pro** and deployed on a **Mac Mini** (or VPS).

### Development (MacBook Pro)
1.  Edit code.
2.  Test locally (`npm run dev`, `./run_worker.sh`).
3.  Push to GitHub:
    ```bash
    git push origin main
    ```

### Deployment (Mac Mini / Server)
The server acts as the worker runner.
1.  **Pull latest code**:
    ```bash
    git pull origin main
    ```
2.  **Update dependencies** (if changed):
    ```bash
    npm install
    pip install -r requirements.txt
    npx prisma migrate dev
    ```
3.  **Cron Job**: Ensures `run_worker.sh` runs on schedule.

---

## 🔑 Key Components & Logic

### Frontend (Next.js)
-   **`app/page.tsx`**: Main entry point. Handles auth state and renders `ChannelManager`.
-   **`components/ChannelManager.tsx`**: UI for adding channels. Supports "Guest Mode" (localStorage) and "User Mode" (Database).
-   **`lib/hooks/useGuestSync.ts`**: Automatically syncs local guest channels to the database upon login.

### Backend (Python Worker)
-   **`worker/`**: Modular package (see Worker Module Details above).
-   **Smart Filtering**: Only processes channels with active subscriptions (via `JOIN` queries) to avoid wasting API tokens on "zombie feeds".

### Database Schema (`prisma/schema.prisma`)

```
┌─────────────────┐       ┌────────────────────────┐
│     users       │       │   youtube_channels     │
├─────────────────┤       ├────────────────────────┤
│ id              │◄──┐   │ id                     │
│ email           │   │   │ youtube_id             │
│ ...             │   │   │ title                  │
└─────────────────┘   │   └────────────────────────┘
                      │              ▲
                      │              │
              ┌───────┴──────────────┴───────┐
              │     youtube_subscriptions    │
              ├──────────────────────────────┤
              │ user_id (FK → users)         │
              │ channel_id (FK → channels)   │
              └──────────────────────────────┘

Similar structure for podcasts:
  podcast_channels ←── podcast_subscriptions ──→ users
```

**Key Tables:**
-   `users`, `accounts`, `sessions`: NextAuth.js authentication
-   `youtube_channels`, `youtube_videos`: YouTube content
-   `youtube_subscriptions`: User ↔ Channel relationships
-   `podcast_channels`, `podcast_episodes`, `podcast_subscriptions`: Podcast support

---

## 🤖 For AI Agents

When working on this codebase:

1. **Frontend changes**: Edit files in `app/` and `components/`
2. **Worker logic changes**: Edit files in `worker/` package
3. **Database changes**: Modify `prisma/schema.prisma`, then run `npx prisma migrate dev`
4. **Testing worker**: Run `python worker.py` or `./run_worker.sh`
5. **Log files**: Worker writes to `cron_log.txt` and `execution_status.log` (gitignored)

### Important Patterns
- Worker uses **lazy loading** for OpenAI client (in `summarize.py`) to speed up imports
- All external API calls are in `transcribe.py` and `summarize.py`
- Database queries only fetch channels with **active subscriptions** to save API costs
