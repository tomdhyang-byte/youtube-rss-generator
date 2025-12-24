<!--
AI MAINTENANCE GUIDE:
This README serves as a hybrid "Operational Manual" for the Vibe Coder (User) and "context source" for AI.
WHEN UPDATING THIS FILE:
1. UI Component Cheat Sheet: MUST be updated whenever a new reusable UI component is created. Provide copy-paste friendly examples.
2. Quick Actions: Keep this list concise. Only add high-frequency commands.
3. Tech Stack: Keep strict version numbers (e.g. Next.js 16) to help AI generate compatible code.
-->

# TubeReader - AI-Powered YouTube & Podcast Reader

> **Concept**: Stop watching 20-minute videos just to find one insight. TubeReader turns YouTube channels and Podcasts into a readable, high-signal news feed using AI.

## 🎯 Project Goal

The goal of this project is to transform the passive, time-consuming experience of "watching/listening" into an active, efficient experience of "reading".

By subscribing to channels here instead of on YouTube:
1.  **Save Time**: Read a 2-minute AI summary instead of watching a 20-minute video.
2.  **Avoid Distractions**: No algorithm, no shorts, no recommendations. Just the content you subscribed to.
3.  **Unified Feed**: Read your Tech YouTube channels and History Podcasts in one clean timeline.

---

## ✨ Key Features

### 1. Web Reader Interface
-   **Clean Timeline**: A unified feed of all your subscriptions.
-   **Instant Read**: Click any card to instantly open the AI summary in a seamless modal.
-   **Read Tracking**: Automatically dims cards you've already read.

### 2. Privacy-First "Guest Mode"
-   Try the app without creating an account.
-   Your first subscription is stored locally in your browser (`localStorage`).
-   Sign in with Google only when you want to sync across devices or add more channels.

### 3. AI Processing
-   **Smart Transcription**: Uses specialized APIs to get accurate text from videos and audio.
-   **Contextual Summaries**: Uses GPT-4o to generate structured summaries that capture the *insight*, not just the transcript.

---

## 🧩 UI Component Cheat Sheet

Use these pre-built components to maintain UI consistency.

### Button
```tsx
import { Button } from "@/components/ui/Button";

// Variants: primary (orange), secondary (blue), ghost, danger, outline
<Button variant="primary" size="md" onClick={handleClick} loading={isLoading}>
  Confirm Action
</Button>
```

### IconButton
```tsx
import { IconButton } from "@/components/ui/IconButton";
import { Trash2 } from "lucide-react";

// Variants: default, danger, warning, muted
<IconButton variant="danger" aria-label="Delete" onClick={handleDelete}>
  <Trash2 className="w-5 h-5" />
</IconButton>
```

### Input
```tsx
import { Input } from "@/components/ui/Input";

<Input 
  label="Email" 
  placeholder="Enter email..." 
  error={errorMessage} // Shows red border + error text
  fullWidth 
/>
```

### Badge
```tsx
import { Badge } from "@/components/ui/Badge";

// Variants: default, success, warning, danger, info, youtube, podcast
<Badge variant="youtube">YouTube</Badge>
```

---

## 🚀 Getting Started

### 1. Visit the App
Go to `http://localhost:3000` (if running locally).

### 2. Subscribe (No Login Required)
Paste a YouTube URL (e.g., `https://youtube.com/@mkbhd`) into the input box on the landing page.

### 3. Read
The AI will process the latest videos (usually takes ~5 mins for a new channel). Once done, they appear in your Feed.

---

## 🛠 For Developers

This project is open-source and built with modern web technologies.

-   **Frontend**: Next.js 16, React Query, Tailwind CSS
-   **UI Components**: Custom component library (Button, IconButton, Input, Badge) + Shadcn
-   **Backend**: Python Worker, OpenAI, Supabase (PostgreSQL)

👉 **[Read the Architecture Documentation](ARCHITECTURE.md)** for a deep dive into the code structure, database schema, and data flow.

### Quick Setup

```bash
# 1. Install Dependencies
npm install

# Backend dependencies
cd backend
pip install -r requirements.txt
cd ..

# 2. Setup Env
cp .env.example .env
# (Fill in your API keys)

# 3. Run Frontend
npm run dev

# 4. Run Worker (in separate terminal)
# Note: Ensure you are in the root directory
npm run worker
# (Or manually: ./backend/run_worker.sh)
```

---

## 📡 RSS Feed Support

In addition to the Web Reader, you can also consume content via RSS feeds in any reader app (e.g., Readwise Reader, Reeder).

| Type | URL Pattern |
|------|-------------|
| YouTube Channel | `/feed/[channelDbId]` |
| Podcast | `/feed/podcast/[podcastDbId]` |

RSS links point to our AI summary pages, so your reader will display the summary, not the original video.

---

## 🔑 Environment Variables

See `.env.example` for required keys:
-   `DATABASE_URL`, `DIRECT_URL` (Supabase)
-   `OPENAI_API_KEY`, `SUPADATA_API_KEY`, `DEEPGRAM_API_KEY`
-   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (for Auth)
