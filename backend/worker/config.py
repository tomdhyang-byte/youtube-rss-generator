"""
Worker Configuration Module
Handles environment variables and API key validation.
"""
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database Configuration
# Use DIRECT_URL for worker if available, otherwise DATABASE_URL
DATABASE_URL = os.getenv('DIRECT_URL') or os.getenv('DATABASE_URL')

# API Keys
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
DEEPGRAM_API_KEY = os.getenv('DEEPGRAM_API_KEY')
SUPADATA_API_KEY = os.getenv('SUPADATA_API_KEY')


# Worker Configuration
POLL_INTERVAL = 10         # Seconds between queue checks
MAINTENANCE_INTERVAL = 3600 # 1 Hour between full scans
STUCK_TASK_THRESHOLD = 1800 # 30 Minutes before resetting stuck tasks

# Free YouTube Transcript API Quota Settings
FREE_API_DAILY_LIMIT = 10          # 每日最多使用次數
FREE_API_COOLDOWN_MINUTES = 30     # 每次使用間隔（分鐘）


def validate_config():
    """
    Validate configuration and print warnings for missing keys.
    Returns True if minimum required config is present.
    """
    is_valid = True
    
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL/DIRECT_URL environment variable is not set")
        is_valid = False
        
    if not OPENAI_API_KEY:
        print("Warning: OPENAI_API_KEY not found. Summaries will be skipped.")
        
    if not DEEPGRAM_API_KEY:
        print("Warning: DEEPGRAM_API_KEY not found. Podcast transcriptions will be skipped.")
        
    if not SUPADATA_API_KEY:
        print("Warning: SUPADATA_API_KEY not found. YouTube transcripts will fail.")
    
    return is_valid
