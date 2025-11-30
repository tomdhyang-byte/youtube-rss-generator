# Personal YouTube RSS Generator

This project allows you to generate personal RSS feeds for YouTube channels and Podcasts with AI-powered summaries. It consists of a Next.js web interface and a Python background worker.

## Features

-   **YouTube & Podcast Support**: Subscribe to both YouTube channels and Podcast RSS feeds.
-   **AI Summaries**: Automatically generates concise summaries for videos and episodes using OpenAI GPT-4o-mini.
-   **Guest Mode**: Try the app without signing in (limited to 1 channel).
-   **User Accounts**: Sign in with Google to manage unlimited subscriptions and sync across devices.
-   **Dark Mode**: Fully supported dark mode interface.
-   **RSS Feeds**: Provides standard RSS 2.0 feeds compatible with any RSS reader.

## Prerequisites

Before you begin, ensure you have the following installed on your machine:

1.  **Node.js** (v18 or later)
2.  **Python** (v3.8 or later)
3.  **PostgreSQL** (Running locally or accessible via URL)
4.  **OpenAI API Key** (for generating summaries)
5.  **Deepgram API Key** (for podcast audio transcription)

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd youtube-rss-generator
    ```

2.  **Install Frontend Dependencies:**
    ```bash
    npm install
    ```

3.  **Install Backend Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

## Configuration

1.  **Environment Variables:**
    Copy the example environment file:
    ```bash
    cp .env.example .env
    ```

2.  **Edit `.env`:**
    Open `.env` and fill in your details:
    -   `DATABASE_URL`: Your PostgreSQL connection string.
    -   `OPENAI_API_KEY`: Your OpenAI API key.
    -   `DEEPGRAM_API_KEY`: Your Deepgram API key (required for podcasts).
    -   `NEXTAUTH_URL`: The canonical URL of your site (e.g., `http://localhost:3000`).
    -   `NEXTAUTH_SECRET`: A random string for session encryption.
    -   `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: For Google Sign-In.

3.  **Setup Database:**
    Run the Prisma migration to create the database schema:
    ```bash
    npx prisma migrate dev
    ```

## Running the Application

### 1. Start the Web Interface
This runs the Next.js frontend at [http://localhost:3000](http://localhost:3000).

```bash
npm run dev
```

### 2. Start the Background Worker
The worker fetches videos/episodes and generates summaries. It handles both YouTube channels and Podcasts.

**Manual Run:**
```bash
chmod +x run_worker.sh
./run_worker.sh
```

**Automated Run (Cron):**
To keep feeds updated, add this to your crontab (`crontab -e`):
```bash
0 * * * * cd /path/to/youtube-rss-generator && ./run_worker.sh >> worker.log 2>&1
```

## Usage

See [USAGE.md](USAGE.md) for detailed usage instructions.

For a guide on managing code across multiple devices (e.g., MacBook Pro for dev, Mac Mini for worker), see [WORKFLOW.md](WORKFLOW.md).

## Deployment

This project is designed to be deployed on **Vercel** (frontend) with a separate worker process (e.g., on a VPS, Railway, or local server) for the Python script.
