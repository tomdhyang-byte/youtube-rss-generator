# Engineering Architecture

This document provides a technical overview of the **YouTube RSS Generator** project. It is designed to help engineers and technical stakeholders understand how the system works, how the code is organized, and how data flows through the application.

## 🏗 System Overview

The system is a **hybrid application** consisting of two main parts:
1.  **Web Application (Next.js)**: Handles the User Interface, Authentication, and API endpoints for the frontend.
2.  **Background Worker (Python)**: Handles the heavy lifting—fetching video data, transcribing audio, and generating AI summaries using LLMs.

### High-Level Diagram

```mermaid
graph TD
    User[User] -->|Web UI| NextJS[Next.js App]
    NextJS -->|Reads/Writes| DB[(PostgreSQL Database)]
    
    subgraph "Background Worker - Python"
        Worker[Worker Script] -->|Polls| DB
        Worker -->|Fetches| YouTube[YouTube]
        Worker -->|Fetches| PodcastRSS[Podcast RSS]
        Worker -->|Transcribes| Supadata[Supadata / Deepgram]
        Worker -->|Summarizes| OpenAI[OpenAI GPT-4]
        Worker -->|Saves| DB
    end
```

---

## 🛠 Technology Stack

### Frontend & API (The "App")
| Technology | Purpose |
|------------|---------|
| Next.js 16 (App Router) | Framework |
| TypeScript | Language |
| Tailwind CSS | Styling |
| React Query | State/Cache |
| NextAuth.js | Auth (Google) |

### Background Worker (The "Brain")
| Technology | Purpose |
|------------|---------|
| Python 3.x | Language |
| pg8000 | DB Access |
| OpenAI API | Summarization |
| Supadata | YT Transcripts |
| Deepgram | Audio Transcripts |

### Database
-   **PostgreSQL** on Supabase.
-   **Prisma** (ORM for Next.js).

---

## 📂 Directory Structure

```
youtube-rss-generator/
├── app/                          # Next.js App Router
│   ├── api/                      #   API Endpoints
│   ├── feed/page.tsx             #   Feed UI
│   ├── subscriptions/page.tsx    #   Subscriptions UI
│   └── page.tsx                  #   Landing Page
│
├── components/                   # React Components
│   ├── ChannelManager/           #   Subscription management
│   ├── FeedCard.tsx              #   Feed item card
│   └── TopNav.tsx                #   Navigation bar
│
├── lib/                          # Shared Utilities
│   ├── hooks/                    #   Custom React Hooks
│   └── prisma.ts                 #   DB Client
│
├── worker/                       # Python Worker
│   ├── youtube.py                #   YT fetching
│   ├── podcast.py                #   Podcast fetching
│   └── summarize.py              #   AI summarization
│
├── prisma/schema.prisma          # Database Schema
└── run_worker.sh                 # Worker startup script
```

---

## 🔄 Core Data Flows

### 1. Adding a Channel
```
User pastes URL → POST /api/channels → API validates & saves → Optimistic UI shows card
```

### 2. Generating Content (Worker)
```
Worker starts → Queries subscribed channels → Fetches new videos → Gets transcript → AI summary → Saves to DB
```

### 3. Reading Feed
```
User visits /feed → React Query calls GET /api/feed → API returns items → UI renders FeedCards
```

---

## 🗄 Database Schema (Simplified)

```
┌───────────────┐       ┌─────────────────────┐
│    users      │       │  youtube_channels   │
├───────────────┤       ├─────────────────────┤
│ id            │◄──┐   │ id                  │
│ email         │   │   │ youtube_id          │
└───────────────┘   │   │ title               │
                    │   └─────────────────────┘
                    │              ▲
            ┌───────┴──────────────┴───────┐
            │   youtube_subscriptions      │
            ├──────────────────────────────┤
            │ user_id (FK)                 │
            │ channel_id (FK)              │
            └──────────────────────────────┘
```
*(Same structure for Podcasts)*

---

## 🚀 Development Quick Start

```bash
# Frontend
npm install && npm run dev

# Worker
pip install -r requirements.txt
./run_worker.sh
```

---

## 🖥 Deployment Model

This project uses a **split deployment** strategy:

| Component | Where it runs | Notes |
|-----------|---------------|-------|
| **Next.js App** | Vercel (or local) | The web UI and API endpoints. |
| **Python Worker** | **Mac Mini (local server)** | Runs via Cron job every hour to fetch new content and generate AI summaries. |
| **Database** | Supabase (cloud) | PostgreSQL. Shared by both App and Worker. |

### Why Mac Mini?
-   The AI processing (transcription + summarization) is CPU/API intensive and runs on a schedule (hourly).
-   Running it on a dedicated local Mac Mini avoids serverless timeout limits and keeps API costs predictable.
-   Code is synced via `git pull` from GitHub.

### Worker Cron Setup (on Mac Mini)
```bash
# Example crontab entry (run every hour)
0 * * * * /path/to/youtube-rss-generator/run_worker.sh >> /path/to/cron_log.txt 2>&1
```
