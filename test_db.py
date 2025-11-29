import os
import psycopg2
from dotenv import load_dotenv
import time

print("Loading environment...")
load_dotenv()

url = os.getenv('DATABASE_URL')
if not url:
    print("Error: DATABASE_URL is not set.")
    exit(1)

print(f"DATABASE_URL found (length: {len(url)})")
# Mask password for safety in logs
safe_url = url.split('@')[-1] if '@' in url else '...'
print(f"Attempting to connect to: ...@{safe_url}")

start = time.time()
try:
    conn = psycopg2.connect(url, connect_timeout=30)
    print("Connection successful!")
    conn.close()
except Exception as e:
    print(f"Connection failed: {e}")

print(f"Time taken: {time.time() - start:.2f}s")
