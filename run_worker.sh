#!/bin/bash

# Activate environment if needed, or just use the direct path to python
# Assuming dependencies are installed in the current environment or a known one.
# Based on previous steps, we used /opt/miniconda3/bin/python

PYTHON_EXEC="/opt/miniconda3/bin/python"

if [ ! -f "$PYTHON_EXEC" ]; then
    echo "Error: Python executable not found at $PYTHON_EXEC"
    echo "Please adjust the script to point to your python environment."
    exit 1
fi

echo "Starting YouTube RSS Worker..."
$PYTHON_EXEC worker.py
echo "Worker finished."
