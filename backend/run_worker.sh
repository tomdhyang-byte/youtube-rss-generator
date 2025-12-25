#!/bin/bash

# Change directory to the PROJECT ROOT
cd "$(dirname "$0")/.."

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

# 1. Try to find a local virtual environment (.venv or venv)
if [ -f "$(dirname "$0")/../.venv/bin/python3" ]; then
    PYTHON_EXEC="$(dirname "$0")/../.venv/bin/python3"
elif [ -f "$(dirname "$0")/../venv/bin/python3" ]; then
    PYTHON_EXEC="$(dirname "$0")/../venv/bin/python3"
else
    # 2. Fallback to system python (Legacy behavior)
    # Check if the hardcoded path exists, if not, find python3 in path
    if [ -f "/usr/local/bin/python3" ]; then
        PYTHON_EXEC="/usr/local/bin/python3"
    else
        PYTHON_EXEC=$(which python3)
    fi
fi

# Verify the executable exists
if [ -z "$PYTHON_EXEC" ] || [ ! -x "$PYTHON_EXEC" ]; then
    echo "Error: Could not find a suitable Python executable."
    echo "Please create a virtual environment: python3 -m venv .venv"
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
    
    # Launch the Daemon Module
    # Note: We use -m to run it as a module to handle relative imports correctly
    echo "Starting Daemon..."
    $PYTHON_EXEC -m backend.worker.daemon
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
