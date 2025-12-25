
# 🚀 Final Deployment SOP (With Virtual Environment)

**Target**: Deploying the latest TubeSummary update (v0.2.0) with SSRF fixes and multi-language support.
**Pre-condition**: You are logged into your server terminal.

---

## 1️⃣ Stop the Old Worker (Critical)
We must stop the old worker to prevent it from crashing due to database changes.

1. **Check for running workers**:
   ```bash
   ps aux | grep worker
   ```
2. **Identify the Process ID (PID)** of the `python` or `npm run worker` process (it's the number in the second column).
3. **Kill the process**:
   ```bash
   kill <PID>
   # Example: kill 12345
   ```
4. **Disable Crontab (If you used crontab just to start it)**:
   ```bash
   crontab -e
   # Comment out the line (put a # in front) that runs run_worker.sh
   # Save and exit (:wq)
   ```

---

## 2️⃣ Update Codebase
Get the latest code with all our changes.

1. **Enter Project Directory**:
   ```bash
   cd ~/youtube-rss-generator  # Or your actual project path
   ```
2. **Pull & Merge**:
   ```bash
   git checkout main
   git pull origin main
   # If you are on a different branch, merge it now:
   # git merge your-feature-branch
   ```

---

## 3️⃣ Set Up Virtual Environment (The New Way!)
We are moving to a clean, isolated environment.

1. **Create the Environment**:
   ```bash
   python3 -m venv .venv
   ```
   *(This creates a hidden `.venv` folder)*

2. **Install Backend Dependencies** (Into `.venv`):
   ```bash
   ./.venv/bin/pip install -r backend/requirements.txt
   ```

3. **Install Frontend Dependencies**:
   ```bash
   npm install
   ```

---

## 4️⃣ Database Migration
Update the database structure (Schema) to support new features.

```bash
npx prisma migrate deploy
```
*(You should see success messages. If it says "Already in sync", that's fine too)*

---

## 5️⃣ Build Frontend
Compile the Next.js application.

```bash
npm run build
```

---

## 6️⃣ Start Services

### Start Frontend (Web App)
*(Command depends on how you run your site. Usually one of these)*:
```bash
npm start
# OR using pm2 (if you have it): pm2 restart youtube-rss
```

### Start Worker (Backend)
The script `run_worker.sh` has been updated to automatically use the `.venv` we created in Step 3.

**Option A: Run in foreground (to check logs immediately)**
```bash
npm run worker
```
*(Press `Ctrl+C` to stop after verifying it works)*

**Option B: Run in background (Production mode)**
```bash
nohup npm run worker > worker.log 2>&1 &
```
*(It will run in the background even if you close the terminal)*

---

## ✅ Verification
Check if everything is running smoothly:

```bash
tail -f worker.log
```
You should see: `Use virtual environment: .../.venv/bin/python3` and `Locked user styles...`.

**Congratulations! Deployment Complete.**
