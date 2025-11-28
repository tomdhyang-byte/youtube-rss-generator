# YouTube RSS Generator - Usage Guide

This project allows you to generate personal RSS feeds for YouTube channels with AI-powered summaries.

## Prerequisites

1.  **OpenAI API Key**: Ensure your `.env` file has a valid `OPENAI_API_KEY`.
2.  **PostgreSQL Database**: Ensure your `.env` file has a valid `DATABASE_URL`.
3.  **Dependencies**: Ensure Node.js and Python dependencies are installed.

## How to Run

### 1. Start the Web Interface

Start the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 2. Add a Channel

1.  In the web interface, paste a YouTube Channel URL (e.g., `https://www.youtube.com/@Veritasium`).
2.  Click **Add Channel**.
3.  The channel will appear in the list.

### 3. Fetch Videos & Generate Summaries

The web interface *does not* automatically fetch videos. You need to run the background worker.

Run the worker script:

```bash
chmod +x run_worker.sh
./run_worker.sh
```

This script will:
*   Fetch the latest videos for all added channels.
*   Download transcripts.
*   Generate AI summaries using OpenAI.
*   Update the database.

### 4. Subscribe to RSS Feed

1.  Back in the web interface, find the channel you added.
2.  Click the **RSS Icon** to copy the feed URL.
3.  Paste this URL into your favorite RSS Reader (e.g., Feedly, Reeder).

## Automation (Optional)

To keep your feeds updated automatically, you can set up a cron job to run `run_worker.sh` every hour.

Example `crontab -e` entry:

```bash
0 * * * * cd /path/to/project && ./run_worker.sh >> worker.log 2>&1
```
