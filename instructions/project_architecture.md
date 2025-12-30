<!--
AI MAINTENANCE GUIDE:
This document is the "Map" of the system.
WHEN UPDATING THIS FILE:
1. Navigation Guide: MUST be updated when new features or major files are added. Map "User Intent" to "File Path".
2. Directory Structure: MUST describe every major file/folder.
3. Data Flow: Keep it simple. Explain "Logical Flow", not implementation details.
-->

# Architecture Documentation

## 🏗 High-Level Architecture

The system consists of three main parts:
1.  **Frontend (Next.js)**: Reads from DB, handles User UI.
2.  **Database (Supabase)**: Stores channels, videos, summaries, and user subscriptions.
3.  **Worker (Python)**: Fetches new content, runs AI summarization, writes to DB.

```mermaid
graph TD
    User[User Browser] <-->|Next.js App| Frontend
    Frontend <-->|Read/Write| DB[(Supabase PG)]
    
    Worker[Python Daemon] -->|Poll| DB[(Queue)]
    Worker -->|Fetch RSS/API| YouTube[YouTube/Podcast]
    Worker -->|Summarize| OpenAI[OpenAI GPT-4]
    Worker -->|Write Content| DB
```

### Frontend Architecture (React Query & State)
*   **Single Source of Truth**: The React Query Cache (`useSubscriptions`) is the master state for all subscription data.
*   **Optimistic UI**: All mutations (Add/Delete) use `onMutate` to immediately update the cache with temporary data, and `onSuccess` to swap in real data (or `onError` to rollback).
*   **UI Components**: Dumb components that render data from the cache. `useChannelManager` handles *UI state* (modals, forms) but delegates *Data Logic* to `useSubscriptions` hooks.

---

## 🧭 Navigation Guide (Where do I modify...?)

Use this guide to quickly find the file you need to change based on your intent.

### Frontend (UI & Logic)
| I want to change... | Go to File |
|---------------------|------------|
| **Homepage** (Landing) | `app/[locale]/page.tsx` |
| **Feed Page** (Reader) | `app/[locale]/feed/page.tsx` |
| **Subscription Manager** | `components/subscription/ChannelManager/index.tsx` |
| **Subscription mutations (Add/Delete)** | `hooks/useSubscriptions.ts` (Core Logic) |
| **Subscription UI State (Modals)** | `components/subscription/ChannelManager/useChannelManager.ts` |
| **Colors / Theme** | `app/globals.css` |
| **Button Styles** | `components/ui/Button.tsx` |
| **Card Design** | `components/subscription/ChannelManager/SubscriptionCard.tsx` |
| **Summary Style Selector** | `components/ui/StyleSelector.tsx` |
| **Article Modal** | `components/feed/ArticleModal.tsx` |
| **i18n Translations** | `messages/en.json`, `messages/zh-TW.json` |
| **i18n Routing** | `routing.ts`, `middleware.ts` |

### Backend (AI & Data)
| I want to change... | Go to File |
|---------------------|------------|
| **AI Summary Prompts** | `backend/worker/summarize.py` |
| **Transcript Fetching** | `backend/worker/transcribe.py` (Multi-tier: Free API → Supadata → Deepgram) |
| **YouTube Fetch Logic** | `backend/worker/youtube.py` |
| **Podcast Fetch Logic** | `backend/worker/podcast.py` |
| **Worker Shared Logic** | `backend/worker/common.py` (New Shared Utils) |
| **Worker Cleanup** | `backend/worker/cleanup.py` (Video Retention Policy - 15 limit) |
| **Worker Config** | `backend/worker/config.py` (API limits, cooldowns) |
| **Worker Daemon** | `backend/worker/daemon.py` (New Entry Point) |
| **Main Worker Loop** | `backend/worker.py` (Legacy/Routine) |
| **Database Schema** | `prisma/schema.prisma` |
| **Style Update API** | `app/api/subscriptions/style/route.ts` |
| **Personalized RSS Feed** | `app/feed/user/[token]/route.ts` |
| **API Shared Utilities** | `lib/api-utils.ts` (Quota/Worker triggers) |
| **Security Validation** | `lib/security.ts` (SSRF Protection) |

---

## 🔄 Data Flow Simplified

Understanding how a video becomes a summary:

1.  **User Adds Channel**:
    *   URL sent to `/api/channels` (Validated by `lib/security.ts`).
    *   Channel saved to DB.
    *   **New**: A `ProcessingQueue` job is created (Status: PENDING).
2.  **Worker Runs (Real-time)**:
    *   Daemon polls DB every 10s.
    *   Picks up the job → Fetches content → Summarizes.
3.  **Transcript Fetching (YouTube)**:
    ```
    ┌─────────────────────────────────────────┐
    │ 1. Free API (youtube-transcript-api)    │
    │    ├─ Daily limit: 10 calls             │
    │    └─ Cooldown: 30 min between calls    │
    │              ↓ (fail or cooldown)       │
    │ 2. Supadata API (paid)                  │
    │              ↓ (no subtitles)           │
    │ 3. Deepgram + yt-dlp (audio → STT)      │
    └─────────────────────────────────────────┘
    ```
4.  **Display**:
    *   User sees "Processing" state initially.
    *   Once worker finishes, feed auto-updates (on refresh).
5.  **Retention Policy**:
    *   Worker automatically keeps only the latest **15 videos** per channel.
    *   Older content is cascade-deleted to maintain database health.

---

## 📂 Directory Structure

```
youtube-rss-generator/
├── app/                          # Next.js App Router
│   ├── [locale]/                 # i18n Locale Routes
│   │   ├── page.tsx              # Landing Page
│   │   ├── feed/page.tsx         # Main Reading Interface
│   │   └── subscriptions/page.tsx # Subscription Management
│   ├── api/                      # Backend API Endpoints
│   └── globals.css               # Global Styles & Variables
│
├── components/                   # React Components
│   ├── ui/                       # Reusable UI Blocks
│   │   ├── Button.tsx            # Standard Button
│   │   ├── IconButton.tsx        # Icon-only Button
│   │   ├── Input.tsx             # Form Input
│   │   ├── Badge.tsx             # Status/Type Label
│   │   ├── StyleSelector.tsx     # Summary Style Picker
│   │   ├── LanguageSelector.tsx  # Summary Language Picker (NEW)
│   │   ├── dialog.tsx            # Modal Base (Shadcn)
│   │   └── tabs.tsx              # Tab Component
│   │
│   ├── layout/                   # Layout Components (Nav, Menu)
│   ├── feed/                     # Feed Components
│   │   ├── FeedCard.tsx          # The article card in the feed
│   │   └── ArticleModal.tsx      # The popup reader view
│   │
│   └── subscription/             # Subscription Components
│       └── ChannelManager/       # The complex subscription manager
│           ├── index.tsx         # Logic for add/remove/refresh
│           ├── useChannelManager.ts # Custom Hook (State/Logic)
│           ├── SubscriptionCard.tsx  # The visual card for channels
│           └── AddChannelForm.tsx    # The input form
│
├── messages/                     # i18n Translation Files
│   ├── en.json                   # English translations
│   └── zh-TW.json                # Traditional Chinese translations
│
├── lib/                          # Utilities
│   ├── prisma.ts                 # Database Client
│   ├── utils.ts                  # Helper Functions
│   ├── api-utils.ts              # Shared API Helpers (Auth/Quota)
│   └── security.ts               # Security Validators (SSRF)
│
├── hooks/                        # Custom React Hooks
│   ├── useFeed.ts                # Data fetching for feed
│   ├── useSubscriptions.ts       # Data fetching for subs
│   └── useReadStatus.ts          # Local storage for read status
│
├── backend/                      # Python Worker (The "Brain")
│   ├── worker/                   # Core Logic Modules
│   │   ├── config.py             # Configuration & Constants (incl. API limits)
│   │   ├── common.py             # Shared Worker Utilities
│   │   ├── cleanup.py            # Video Retention Logic
│   │   ├── daemon.py             # Real-time Polling Engine
│   │   ├── transcribe.py         # Multi-tier Transcript Fetching (NEW)
│   │   ├── summarize.py          # AI Prompts & Logic
│   │   ├── youtube.py            # YouTube API Handling
│   │   └── podcast.py            # Podcast API Handling
│   ├── worker.py                 # (Legacy) Full Scan Routine
│   ├── run_worker.sh             # Launch Script
│   └── requirements.txt          # Python Dependencies
│
├── routing.ts                    # i18n Routing Config
├── i18n.ts                       # i18n Request Config
├── middleware.ts                 # Next.js Middleware (Auth + i18n)
│
├── public/                       # Static Assets
│   └── logo.png                  # App Logo (TubeSummary)
│
└── prisma/                       # Database
    └── schema.prisma             # Database Schema Definition
```

---

## 🗄 Database Schema (Key Concepts)

### Core Tables
*   **Channel**: A YouTube channel (`youtube_channels`) or Podcast feed (`podcast_channels`).
*   **Video/Episode**: Individual content items with `transcript`.
*   **Subscription**: Link between `User` and `Channel`, includes `summaryStyle` preference.
*   **ProcessingQueue**: Tracks background jobs for real-time processing.

### Summary Style Tables
*   **VideoSummary / EpisodeSummary**: Stores summaries per content, per style, **per language**. One video can have multiple summaries (e.g. DEFAULT-EN, DEFAULT-ZH, QUICK-EN...).
*   **UserVideoStyle / UserEpisodeStyle**: **Locks** the style AND language for each user at processing time. Ensures RSS feed stability - style/language changes only affect future content.
*   **User.feedToken**: Unique token for personalized RSS feed (`/feed/user/[token]`).

### Locked Styles Design
```mermaid
sequenceDiagram
    User->>Subscription: Set style = QUICK_READ
    Worker->>Video: New video detected
    Worker->>VideoSummary: Generate QUICK_READ summary (e.g. in EN)
    Worker->>UserVideoStyle: Lock (userId, videoId, QUICK_READ, EN)
    User->>Subscription: Change style to DEFAULT
    Note over UserVideoStyle: Old videos still show QUICK_READ
    Worker->>Video: Next new video
    Worker->>VideoSummary: Generate DEFAULT summary
```

## 🔗 Critical Dependencies (READ THIS to avoid "Fix A Break B")

This section explicitly lists **coupled** parts of the system. If you touch one, you MUST check the other.

### 1. Database Schema ↔ Python Worker
*   **Context**: The Python worker (`backend/worker/`) uses raw SQL or a DB driver that expects the exact table structure defined in `prisma/schema.prisma`.
*   **Rule**: If you modify `prisma/schema.prisma` (especially table names or column names), you MUST grep the `backend/worker` directory for the old name and update the SQL queries/logic accordingly.
*   **Risk**: The worker will crash silently or fail to pick up jobs if the queue table schema changes.

### 2. Processing Queue Status ↔ UI Feedback
*   **Context**: The Frontend monitors `ProcessingQueue` status (PENDING, PROCESSING, COMPLETED, FAILED).
*   **Rule**: These status strings are HARDCODED in `backend/worker/daemon.py` (or `common.py`) and `prisma/schema.prisma`.
*   **Risk**: Changing a Status Enum in Prisma without updating the Python Worker's state machine will cause infinite "Processing" spinners in the UI.

### 3. Summary Style Enums ↔ Style Selector
*   **Context**: `SummaryStyle` (DEFAULT, QUICK_READ) and `SummaryLanguage` are Enums.
*   **Rule**: If you add a new Style:
    1.  Add to `prisma/schema.prisma`.
    2.  Add to Frontend `components/ui/StyleSelector.tsx`.
    3.  Add prompt logic in `backend/worker/summarize.py`.
*   **Risk**: Users select a new style, but the Worker defaults to "DEFAULT" because it doesn't know the new Enum value.

### 4. YouTube API ↔ Quota Management
*   **Context**: `backend/worker/youtube.py` and `config.py` manage daily limits.
*   **Rule**: Do not bypass `config.py` limits to "fix" a bug where videos aren't fetching. The limit is there for a reason (cost/ban prevention).
