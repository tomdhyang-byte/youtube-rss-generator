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

# Try removing channel_binding
if 'channel_binding=require' in url:
    print("Detected channel_binding=require. Removing it for test...")
    url = url.replace('channel_binding=require', '')
    # Clean up potentially double &&
    url = url.replace('&&', '&').strip('&')

print(f"Attempting to connect with modified URL...")

start = time.time()
try:
    conn = psycopg2.connect(url, connect_timeout=5)
    print("Connection successful with modified URL!")
    conn.close()
except Exception as e:
    print(f"Connection failed: {e}")

print(f"Time taken: {time.time() - start:.2f}s")
