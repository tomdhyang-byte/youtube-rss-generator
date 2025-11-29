import psycopg2
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print("Error: DATABASE_URL not found in environment variables")
    exit(1)

# Remove pgbouncer param for psycopg2
clean_url = DATABASE_URL.replace('?pgbouncer=true', '').replace('&pgbouncer=true', '')

try:
    print("Connecting to database...")
    conn = psycopg2.connect(clean_url, connect_timeout=30)
    cursor = conn.cursor()
    
    print("Adding avatar_url column to Channel table...")
    cursor.execute('ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS avatar_url TEXT;')
    conn.commit()
    
    print("✓ Successfully added avatar_url column!")
    
    cursor.close()
    conn.close()
    print("Migration complete.")
    
except Exception as e:
    print(f"Error: {e}")
    exit(1)
