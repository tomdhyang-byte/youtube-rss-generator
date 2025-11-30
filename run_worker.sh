#!/bin/bash

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

# Check if VIRTUAL_ENV is set (active virtualenv)
if [ -n "$VIRTUAL_ENV" ]; then
    PYTHON_EXEC="$VIRTUAL_ENV/bin/python"
elif [ -f "./.venv/bin/python" ]; then
    PYTHON_EXEC="./.venv/bin/python"
elif [ -f "./venv/bin/python" ]; then
    PYTHON_EXEC="./venv/bin/python"
elif command -v python3 &> /dev/null; then
    PYTHON_EXEC=$(command -v python3)
elif command -v python &> /dev/null; then
    PYTHON_EXEC=$(command -v python)
fi

if [ -z "$PYTHON_EXEC" ]; then
    echo "Error: Could not find a suitable Python executable."
    echo "Please ensure Python 3 is installed or activate your virtual environment."
    exit 1
fi

echo "Using Python: $PYTHON_EXEC"
echo "Starting YouTube RSS Worker..."
$PYTHON_EXEC worker.py
echo "Worker finished."
