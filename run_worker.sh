#!/bin/bash

# Change directory to the script's location to ensure relative paths work
cd "$(dirname "$0")"

# Activate environment if needed, or just use the direct path to python
# Assuming dependencies are installed in the current environment or a known one.
# Based on previous steps, we used /opt/miniconda3/bin/python

# Try to find python in the following order:
# 1. Active virtual environment
# 2. Local .venv or venv directory
# 3. System python3
# 4. System python

# --- OPTIONAL: Auto-Update ---
# Uncomment the following lines to enable auto-update from GitHub
# echo "Checking for updates..."
# git pull origin main
# if [ $? -ne 0 ]; then
#     echo "Warning: Git pull failed. Continuing with existing code..."
# fi
# -----------------------------

PYTHON_EXEC=""

# Hardcoded path for stability in cron environment
PYTHON_EXEC="/Users/a01-0218-0512/.gemini/antigravity/scratch/youtube-rss-generator/.venv/bin/python"

# Verify the executable exists
if [ ! -f "$PYTHON_EXEC" ]; then
    echo "Error: Python executable not found at $PYTHON_EXEC"
    exit 1
fi

if [ -z "$PYTHON_EXEC" ]; then
    echo "Error: Could not find a suitable Python executable."
    echo "Please ensure Python 3 is installed or activate your virtual environment."
    exit 1
fi

# Define log files
LOG_FILE="cron_log.txt"
STATUS_LOG="execution_status.log"

{
    echo "========================================"
    echo "Run started at $(date)"
    echo "Using Python: $PYTHON_EXEC"
    echo "Starting YouTube RSS Worker..."
    
    $PYTHON_EXEC worker.py
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo "[$(date)] SUCCESS" >> "$STATUS_LOG"
        echo "Worker finished successfully."
    else
        echo "[$(date)] FAILED (Exit Code: $EXIT_CODE)" >> "$STATUS_LOG"
        echo "Worker failed with exit code $EXIT_CODE."
    fi
    
    echo "========================================"
} >> "$LOG_FILE" 2>&1
