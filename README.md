# Personal YouTube RSS Generator

> **AI Context**: This project is a hybrid Next.js (Frontend/API) and Python (Worker) application designed to generate RSS feeds with AI summaries for YouTube channels and Podcasts. The worker is modularized for maintainability.

## 🏗 Architecture Overview

-   **Frontend**: Next.js 14 (App Router), Tailwind CSS, Lucide React.
-   **Backend**: Next.js API Routes (for UI interactions), Python Worker (for heavy lifting).
-   **Database**: PostgreSQL (Supabase) accessed via Prisma (Next.js) and `pg8000` (Python).
-   **AI**: OpenAI GPT-4.1 for summarization, Supadata for YouTube transcripts, Deepgram for podcast transcription.
-   **Authentication**: NextAuth.js (Google Provider).

---

## 📁 Project Structure

```
youtube-rss-generator/
├── app/                          # Next.js App Router
│   ├── api/                      #   API Routes
│   │   ├── channels/             #     YouTube channel CRUD
│   │   ├── podcasts/             #     Podcast CRUD
│   │   ├── subscriptions/        #     User subscriptions
│   │   └── auth/                 #     NextAuth endpoints
│   ├── feed/                     #   RSS feed routes
│   ├── page.tsx                  #   Main UI entry point
│   └── layout.tsx                #   Root layout
│
├── components/                   # React Components
│   ├── ChannelManager/           #   🆕 Modularized subscription manager
│   │   ├── index.tsx             #     Main component (tabs, state)
│   │   ├── AddChannelForm.tsx    #     URL input form
│   │   ├── ChannelCard.tsx       #     YouTube channel card
│   │   ├── PodcastCard.tsx       #     Podcast card
│   │   └── types.ts              #     TypeScript interfaces
│   ├── ChannelManager.tsx        #   Re-export for backward compatibility
│   ├── UserMenu.tsx              #   User dropdown
│   ├── LoginModal.tsx            #   Login dialog
│   └── ui/                       #   Shared UI components
│
├── lib/                          # Shared utilities
│   ├── prisma.ts                 #   Prisma client singleton
│   ├── auth.ts                   #   Auth configuration
│   ├── types.ts                  #   TypeScript types
│   └── hooks/                    #   Custom React hooks
│       ├── useLocalStorage.ts    #     LocalStorage hook
│       └── useGuestSync.ts       #     Guest → User sync
│
├── prisma/
│   └── schema.prisma             # Database schema (PostgreSQL)
│
├── worker/                       # 🆕 Python Worker Package (Modularized)
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
