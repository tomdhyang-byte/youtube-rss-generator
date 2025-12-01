# Personal YouTube RSS Generator

> **AI Context**: This project is a hybrid Next.js (Frontend/API) and Python (Worker) application designed to generate RSS feeds with AI summaries for YouTube channels and Podcasts.

## 🏗 Architecture Overview

-   **Frontend**: Next.js 14 (App Router), Tailwind CSS, Lucide React.
-   **Backend**: Next.js API Routes (for UI interactions), Python Worker (for heavy lifting).
-   **Database**: PostgreSQL (Supabase) accessed via Prisma (Next.js) and `pg8000` (Python).
-   **AI**: OpenAI GPT-4o-mini for summarization, Deepgram for podcast transcription.
-   **Authentication**: NextAuth.js (Google Provider).

### Project Structure
```
youtube-rss-generator/
├── app/                          # Next.js App Router (UI & API)
├── components/                   # React components (ChannelManager, UserMenu, etc.)
├── prisma/
│   └── schema.prisma             # Database schema (PostgreSQL)
├── worker.py                     # Python worker (fetch + summarize)
├── run_worker.sh                 # Wrapper script for worker (env + logging)
├── cron_log.txt                  # Detailed worker logs
└── execution_status.log          # Simplified success/failure logs
```

## 🚀 Quick Start

### 1. Prerequisites
-   Node.js (v18+)
-   Python (v3.8+)
-   PostgreSQL Database (Supabase recommended)
-   OpenAI API Key
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
```
*Note: The script automatically logs to `cron_log.txt` and `execution_status.log`.*

**Automated Run (Cron):**
```bash
# Run every day at 11:20 AM
20 11 * * * /path/to/youtube-rss-generator/run_worker.sh
```

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

### Auto-Update Strategy
The `run_worker.sh` script has commented-out lines for `git pull`. It is **recommended to keep this disabled** and update manually to prevent unexpected breakages in the background process.

## 🔑 Key Components & Logic

### Frontend (Next.js)
-   **`app/page.tsx`**: Main entry point. Handles auth state and renders `ChannelManager`.
-   **`components/ChannelManager.tsx`**: UI for adding channels. Supports "Guest Mode" (localStorage) and "User Mode" (Database).
-   **`lib/hooks/useGuestSync.ts`**: Automatically syncs local guest channels to the database upon login.

### Backend (Python Worker)
-   **`worker.py`**:
    1.  Fetches latest 3 videos/episodes via `scrapetube` or `feedparser`.
    2.  Checks DB for duplicates.
    3.  Fetches transcripts via `youtube_transcript_api` or `Deepgram`.
    4.  Generates summaries via OpenAI GPT-4o-mini.
    5.  Saves to DB using `pg8000` (SSL verification disabled for compatibility).

### Database Schema (`prisma/schema.prisma`)
-   **`users`, `accounts`, `sessions`**: NextAuth.js tables.
-   **`youtube_channels`, `youtube_videos`**: Content tables.
-   **`youtube_subscriptions`**: Links users to channels.
-   **`podcast_channels`, `podcast_episodes`**: Podcast support.
