# Multi-Device Workflow Guide

This guide explains how to develop on your **MacBook Pro** and run the background worker on your **Mac Mini** seamlessly.

## 🔄 The Workflow

The core concept is to use **Git** (via GitHub) as the synchronization bridge between your two machines.

1.  **Develop** on MacBook Pro.
2.  **Push** changes to GitHub.
3.  **Pull** changes on Mac Mini.
4.  **Cron** runs the worker automatically on Mac Mini.

---

## 💻 1. Development (MacBook Pro)

This is where you write code, update configuration, and test the web interface.

1.  **Make Changes**: Edit files, add features, etc.
2.  **Test Locally**: Run `npm run dev` and `./run_worker.sh` to ensure everything works.
3.  **Commit & Push**:
    ```bash
    git add .
    git commit -m "Update worker logic"
    git push origin main
    ```

---

## 🖥️ 2. Deployment (Mac Mini)

The Mac Mini acts as your "server". You only need to update the code periodically.

1.  **Pull Latest Code**:
    ```bash
    cd /path/to/youtube-rss-generator
    git pull origin main
    ```
2.  **Update Dependencies** (if needed):
    - If you changed `requirements.txt`: `pip install -r requirements.txt`
    - If you changed `package.json`: `npm install`
    - If you changed `schema.prisma`: `npx prisma migrate dev`

---

## ⏰ 3. Cron Job Setup (Mac Mini)

To ensure the worker runs reliably via `cron`, follow these best practices.

### A. Use Absolute Paths
Cron runs in a minimal environment, so it doesn't know where your files are. Always use absolute paths.

### B. The Wrapper Script (`run_worker.sh`)
Your `run_worker.sh` should handle setting up the environment. Ensure it looks something like this:

```bash
#!/bin/bash

# 1. Navigate to the project directory (Absolute Path)
cd /Users/your-username/youtube-rss-generator

# 2. Activate Virtual Environment (if using one)
# source .venv/bin/activate

# 3. Load Environment Variables (if not loaded by python-dotenv)
# export DATABASE_URL=...

# 4. Run the Worker
/usr/bin/python3 worker.py
```

### C. Crontab Entry
Edit your crontab with `crontab -e`:

```bash
# Run every hour
0 * * * * /Users/your-username/youtube-rss-generator/run_worker.sh >> /Users/your-username/youtube-rss-generator/cron_log.txt 2>&1
```

-   `>> ... 2>&1`: This captures both standard output and errors to a log file, which is crucial for debugging why a cron job might have failed.

---

## 🛠️ Pro Tips

### Remote Management via SSH
You don't need to physically sit at your Mac Mini to pull code. You can SSH into it from your MacBook Pro.

1.  **Enable Remote Login** on Mac Mini: System Settings -> General -> Sharing -> Remote Login.
2.  **Connect from MacBook Pro**:
    ```bash
    ssh username@mac-mini-ip-address
    ```
3.  **Run Commands**: Once connected, you can run `git pull`, check logs (`tail -f cron_log.txt`), etc.

### VS Code Remote - SSH
For an even better experience, use the **Remote - SSH** extension in VS Code on your MacBook Pro to open folders on your Mac Mini as if they were local.

---

## 🔄 Auto-Update Strategy

You might wonder: **"Should I make the worker pull from GitHub automatically before running?"**

### The Trade-off

| Strategy | Pros | Cons |
| :--- | :--- | :--- |
| **Manual Pull** (Recommended) | ✅ Safe. You control when code changes.<br>✅ No surprise breakages. | ❌ You must remember to SSH in and pull.<br>❌ Worker might run old code if you forget. |
| **Auto Pull** | ✅ Always runs the latest code.<br>✅ "Set and forget". | ⚠️ **Risk of Breakage**: If you add a new dependency (e.g., in `requirements.txt`) but the worker doesn't install it, it will crash.<br>⚠️ **Merge Conflicts**: If you edited files on the Mac Mini directly, `git pull` might fail. |

### Recommendation
If you want **Auto Pull**, use it with caution. We have updated `run_worker.sh` to support this, but it is disabled by default. Uncomment the lines in the script to enable it.

**Safety Tip**: If you change `requirements.txt` or `schema.prisma`, **ALWAYS** SSH into the Mac Mini and run the updates manually (`pip install...` or `prisma migrate...`) to ensure the environment is ready.
