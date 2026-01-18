# ⚙️ Worker Troubleshooting Guide

The Python Worker (`backend/worker`) is the engine of the application. It runs locally or on a VPS as a daemon.

## 🏗 Architecture Refresh
*   **Type**: Polling Daemon.
*   **Entry Point**: `backend/worker/daemon.py`
*   **Loop**: Infinite `while True` loop with `time.sleep(POLL_INTERVAL)`.
*   **State Source**: `ProcessingQueue` table in PostgreSQL.
*   **Key Modules**:
    - `worker/youtube.py` - Orchestration (~200 lines)
    - `services/youtube_metadata.py` - RSS & Scrapetube fetching
    - `worker/transcribe.py` - Transcript fetching (incl. yt-dlp+Whisper fallback)

## 🚨 Common Alerts & Fixes

### 1. "Processing" Stuck Forever (Zombie Tasks)
*   **Symptom**: The UI shows a spinning loader for > 10 minutes.
*   **Cause**: The worker crashed *mid-execution* (e.g., OOM, error) and didn't update the status to `FAILED`.
*   **Auto-Fix**: `daemon.py` has a `recover_stuck_tasks()` method that runs on startup.
*   **Manual Fix**:
    ```sql
    UPDATE processing_queue SET status = 'PENDING' WHERE status = 'PROCESSING';
    ```
    Then restart the worker.

### 2. HTTP 429 / 403 (YouTube API)
*   **Symptom**: Logs show `googleapiclient.errors.HttpError: <HttpError 403 ... "quotaExceeded">`.
*   **Cause**: We hit the 10,000 unit daily limit.
*   **Action**: Nothing to do but wait for Pacific Time midnight (PT).
*   **Prevention**: Ensure `DAILY_LIMIT` in `config.py` is enabled.

### 3. "Database Connection Failed"
*   **Symptom**: `psycopg2.OperationalError` in logs.
*   **Cause**: Supabase pauses the project after inactivity, or network blip.
*   **Fix**: The worker should auto-retry. If not, restart the service.

## 📝 Operating Procedures

### How to Check Logs
*   **Standard**: `tail -f execution_status.log`
*   **Cron (if used)**: `tail -f cron_log.txt`

### How to Restart (Manual / Dev)
1.  Find the process:
    ```bash
    ps aux | grep daemon.py
    ```
2.  Kill it:
    ```bash
    kill -9 [PID]
    ```
3.  Start (Background):
    ```bash
    nohup python3 -m backend.worker.daemon > execution_status.log 2>&1 &
    ```

### How to Restart (Supervisor / Systemd)
*   If using Supervisor: `sudo supervisorctl restart youtube-worker`
*   If using Docker: `docker restart youtube-worker`

### How to Run Unit Tests
Before deploying worker changes, verify unit tests pass:
```bash
# Run all tests
python -m pytest tests/ -v

# Run specific test file
python -m pytest tests/test_youtube_metadata.py -v

# Verify imports work (quick sanity check)
python -c "from backend.services.youtube_metadata import fetch_videos_from_rss; from backend.worker.youtube import process_youtube_channel; print('OK')"
```
