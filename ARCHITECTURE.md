# Personal YouTube RSS Generator - Architecture Overview

## 🎯 Project Purpose
A self-hosted web application that generates AI-summarized RSS feeds from YouTube channels. Users subscribe to channels via a web interface, a background worker fetches video transcripts, generates AI summaries, and serves them as RSS feeds.

---

## 📁 Project Structure

```
youtube-rss-generator/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Main UI (channel management)
│   ├── layout.tsx                # Root layout with theme provider
│   ├── globals.css               # Global styles (Tailwind)
│   ├── api/
│   │   └── channels/route.ts     # API: Add/list channels
│   └── feed/
│       └── [channelId]/route.ts  # API: Generate RSS feed
│
├── components/                   # React components
│   ├── ChannelManager.tsx        # Channel list & add form
│   ├── ThemeProvider.tsx         # Dark mode context
│   └── ThemeToggle.tsx           # Dark mode toggle button
│
├── prisma/
│   └── schema.prisma             # Database schema (PostgreSQL)
│
├── middleware.ts                 # HTTP Basic Auth (excludes /feed)
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
  - Fetches all channels from PostgreSQL via Prisma
  - Renders `<ChannelManager>` with channel data
  - Includes `<ThemeToggle>` for dark mode

#### `components/ChannelManager.tsx`
- **Purpose**: UI for adding channels and displaying subscriptions
- **Key Features**:
  - Input field for YouTube channel URLs
  - Calls `/api/channels` POST to add new channels
  - Displays list of channels with:
    - Channel title & description
    - Last updated timestamp
    - Copy RSS link button
    - Link to original YouTube channel
  - **HTML Entity Handling**: Uses `decodeHtml()` to fix `&amp;` → `&`
  - **Responsive**: Dark mode support, centered cards with text truncation

#### `app/api/channels/route.ts`
- **POST**: Extracts YouTube channel ID from URL, saves to DB
- **GET**: Returns all channels ordered by `last_updated`

#### `app/feed/[channelId]/route.ts`
- **Purpose**: Generates RSS XML for a specific channel
- **Logic**:
  1. Queries channel + videos from DB (latest 20)
  2. Builds RSS feed using `rss` package
  3. Sets `Cache-Control: no-store` to prevent stale feeds
  4. Returns XML with AI summaries as descriptions

#### `middleware.ts`
- **Purpose**: HTTP Basic Auth for the web interface
- **Whitelist**:
  - `/feed/*` → Public (for RSS readers)
  - `/_next/*`, `/favicon.ico` → Public
  - Everything else → Protected by `AUTH_PASSWORD`

---

### **Backend (Python Worker)**

#### `worker.py`
- **Purpose**: Fetches new videos, generates AI summaries, saves to DB
- **Flow**:
  1. **Fetch Videos**: Uses `scrapetube` to get latest 3 videos per channel
  2. **Fetch Transcript**: `YouTubeTranscriptApi.fetch()` with language priority:
     - `['zh-TW', 'zh-Hant', 'zh-Hans', 'zh', 'en']`
  3. **Generate Summary**: Calls OpenAI GPT-4o with custom prompt (繁體中文)
     - Prompt designed for **detailed, structured summaries** with:
       - 🎯 核心主旨 (Executive Summary)
       - 🔑 關鍵洞察 (Key Insights with bullet points)
       - 💡 結論 (Action Items)
  4. **Save to DB**: Inserts new videos with summaries
  5. **Rate Limiting**: Random delay 5-10 seconds between videos to avoid IP bans
- **Error Handling**: Saves "No transcript available." if fetch fails

#### `run_worker.sh`
- Dynamically detects Python executable (virtualenv or system)
- Executes `worker.py`

---

## 🗄️ Database Schema (`prisma/schema.prisma`)

### **Channel** Table
```prisma
model Channel {
  id            Int       @id @default(autoincrement())
  youtube_id    String    @unique
  title         String
  description   String?
  rss_url       String?
  last_updated  DateTime  @default(now())
  videos        Video[]
}
```

### **Video** Table
```prisma
model Video {
  id                Int       @id @default(autoincrement())
  youtube_video_id  String    @unique
  channel_id        Int
  title             String
  summary           String    @db.Text
  published_at      DateTime
  channel           Channel   @relation(fields: [channel_id], references: [id])
}
```

---

## 🔧 Environment Variables (`.env`)

| Variable            | Purpose                                  |
|---------------------|------------------------------------------|
| `DATABASE_URL`      | PostgreSQL connection string             |
| `OPENAI_API_KEY`    | OpenAI API key for GPT summaries        |
| `AUTH_PASSWORD`     | HTTP Basic Auth password (user: `admin`)|

---

## 🚀 Deployment & Execution

### **Web App (Vercel)**
- **Platform**: Vercel
- **Auto-deploy**: Pushes to GitHub `main` branch trigger deployments
- **Database**: PostgreSQL (external, e.g., Neon, Supabase)

### **Worker Automation**
- **Method**: Crontab on local machine or server
- **Example Schedule** (every 2, 6, 12, 14, 18, 20, 22:00):
  ```bash
  0 6,12,14,18,20,22 * * * cd /path/to/project && ./run_worker.sh >> cron_log.txt 2>&1
  ```
- **Important**: Avoid running too frequently to prevent YouTube IP bans

---

## 🛠️ Tech Stack

| Layer          | Technology                          |
|----------------|-------------------------------------|
| Frontend       | Next.js 16, React, TypeScript       |
| Styling        | Tailwind CSS v4, Dark Mode          |
| Database       | PostgreSQL + Prisma ORM             |
| Worker         | Python 3.8+                         |
| Transcript API | `youtube-transcript-api`            |
| Video Fetcher  | `scrapetube`                        |
| AI Summarizer  | OpenAI GPT-4o                       |
| RSS Generator  | `rss` (npm)                         |
| Auth           | Custom HTTP Basic Auth middleware   |

---

## 🧑‍💻 Collaboration Notes

### **For Frontend Work**
- **Main Files**: `components/ChannelManager.tsx`, `app/page.tsx`
- **Styling**: Uses Tailwind CSS with dark mode (`dark:` prefix)
- **State Management**: Simple React state, no Redux/Zustand
- **API Calls**: Uses native `fetch()` to `/api/channels`

### **For Backend/Worker Work**
- **Main File**: `worker.py`
- **Dependencies**: Install via `pip install -r requirements.txt`
- **Testing**: Run `./run_worker.sh` manually, check `cron_log.txt` for output
- **Key Concerns**:
  - IP blocking → Use random delays, avoid frequent runs
  - Language support → Already handles zh/en transcripts
  - OpenAI API costs → Currently uses GPT-4o (higher quality)

### **For Database Changes**
- Edit `prisma/schema.prisma`
- Run `npx prisma migrate dev` to apply changes
- Worker uses raw SQL via `psycopg2`, frontend uses Prisma Client

### **Common Issues & Solutions**
1. **"No transcript available"** → Check language codes, IP ban (wait 1-2 hours)
2. **RSS not updating** → Verify `Cache-Control: no-store` in `/feed/[channelId]/route.ts`
3. **Build fails on Vercel** → Ensure `DATABASE_URL` is set in Vercel environment variables
4. **Worker not running** → Check Python path in `run_worker.sh`, verify crontab with `crontab -l`

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
   # Fill in DATABASE_URL, OPENAI_API_KEY, AUTH_PASSWORD
   ```

3. **Database Setup**:
   ```bash
   npx prisma migrate dev
   ```

4. **Run Locally**:
   ```bash
   npm run dev              # Frontend at http://localhost:3000
   ./run_worker.sh          # Worker (run manually for testing)
   ```

5. **Test**:
   - Add a YouTube channel via the web UI
   - Run `./run_worker.sh` to fetch summaries
   - Access RSS feed at `http://localhost:3000/feed/1`

---

**Last Updated**: 2025-11-28  
**Primary Contact**: [Your Name/Email]
