import psycopg2
from psycopg2.extras import RealDictCursor
import os
import time
import random
from datetime import datetime
import scrapetube
from youtube_transcript_api import YouTubeTranscriptApi
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
DATABASE_URL = os.getenv('DATABASE_URL')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

if not OPENAI_API_KEY:
    print("Warning: OPENAI_API_KEY not found in environment variables. Summaries will be mocked or skipped.")

client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

def get_db_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is not set")
    conn = psycopg2.connect(DATABASE_URL)
    return conn

def fetch_transcript(video_id):
    try:
        # Instantiate the API
        api = YouTubeTranscriptApi()
        # Use fetch with language priority: Chinese (Traditional, Simplified, Generic) then English
        transcript_list = api.fetch(video_id, languages=['zh-TW', 'zh-Hant', 'zh-Hans', 'zh', 'en'])
        # Combine text
        full_text = " ".join([t.text for t in transcript_list])
        return full_text
    except Exception as e:
        print(f"  - No transcript found or error: {e}")
        return None

def generate_summary(text):
    if not client:
        return "Summary not available (Missing OpenAI Key)."
    
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo", # Or gpt-4o-mini for cost efficiency
            messages=[
                {"role": "system", "content": """你是一位資深的繁體中文內容分析師。請針對這段影片字幕進行「深度摘要」。
    
目標：你的讀者是忙碌的專業人士，他們希望「不用看影片」也能掌握 90% 的精華細節。
原則：不要只寫流水帳，要提取洞察 (Insights)，並保留具體的例子或數據。
請嚴格遵守以下 HTML 格式回傳（因為要嵌入 RSS，請勿使用 Markdown）：

    <p><b>🎯 核心主旨 (Executive Summary)：</b><br>
    (請用一段約 100-150 字的完整段落，清楚說明這部影片在解決什麼問題，以及講者的核心立場。)</p>

    <h3>🔑 關鍵洞察與細節：</h3>
    <ul>
        <li><b>重點 1 - (請自擬小標題)：</b>(請詳細解釋這個觀點，包含講者的邏輯推演、提到的案例或數據支持。不要只有一句話。)</li>
        <li><b>重點 2 - (請自擬小標題)：</b>(同上，請深入挖掘細節。)</li>
        <li><b>重點 3 - (請自擬小標題)：</b>(同上，請深入挖掘細節。)</li>
        <li><b>重點 4 - (請自擬小標題)：</b>(如果有更多重點，請繼續列出，不限於 3 點。)</li>
    </ul>

    <h3>💡 結論或行動建議：</h3>
    <p>(講者最後給出的建議、對未來的預測，或是你歸納出的具體行動方案。)</p>"""},
                {"role": "user", "content": f"影片字幕內容如下：\n\n{text[:15000]}"} 
            ]
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"  - OpenAI API Error: {e}")
        return "Summary generation failed."

def process_channel(conn, channel):
    channel_id = channel['id']
    youtube_id = channel['youtube_id']
    channel_title = channel['title']
    
    print(f"Processing Channel: {channel_title} ({youtube_id})")
    
    # Update Channel Metadata if needed (if it was added via Vercel with placeholder)
    if channel_title == 'New Channel' or channel['description'] == 'Waiting for worker to update...':
        print("  - Updating channel metadata...")
        try:
            # We can use scrapetube to get some info, or just rely on the videos.
            # Actually, scrapetube doesn't give channel description easily.
            # But we can assume if we fetch videos, we might get the author name from the first video.
            pass # We will update title from the first video found
        except Exception as e:
            print(f"  - Failed to update metadata: {e}")

    # Fetch latest videos (limit to last 5 to avoid quota/time issues on first run)
    try:
        videos = scrapetube.get_channel(channel_id=youtube_id, limit=5)
    except Exception as e:
        print(f"  - Error fetching videos: {e}")
        return

    first_video = True
    for video in videos:
        video_id = video['videoId']
        title = video['title']['runs'][0]['text']
        
        # Update Channel Title from video if it's a placeholder
        if first_video and (channel_title == 'New Channel'):
             # Try to get channel name from video details
             # scrapetube video object usually has 'ownerText' or similar in 'shortBylineText'
             try:
                 new_title = video.get('ownerText', {}).get('runs', [{}])[0].get('text')
                 if not new_title:
                     # Fallback to looking deeper if structure varies
                     new_title = video.get('shortBylineText', {}).get('runs', [{}])[0].get('text')
                 
                 if new_title:
                     print(f"    - Found real channel title: {new_title}")
                     cursor = conn.cursor()
                     cursor.execute("UPDATE \"Channel\" SET title = %s, description = %s WHERE id = %s", 
                                  (new_title, "Updated by worker", channel_id))
                     conn.commit()
                     channel_title = new_title # Update local var
             except Exception as e:
                 print(f"    - Could not extract channel title from video: {e}")
        first_video = False
        
        # Check if exists
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT id FROM \"Video\" WHERE youtube_video_id = %s", (video_id,))
        if cursor.fetchone():
            print(f"  - Video already exists: {title}")
            continue
            
        print(f"  - New Video found: {title}")
        
        # Get Transcript
        transcript = fetch_transcript(video_id)
        summary = "No transcript available."
        
        if transcript:
            print("    - Transcript fetched. Generating summary...")
            summary = generate_summary(transcript)
        
        # Parse published time
        # For Postgres, we can store as TIMESTAMP (datetime object) or keep using milliseconds/ISO if schema allows.
        # Prisma schema says `DateTime`. Prisma usually maps this to `timestamp(3)` in Postgres.
        # It expects a valid timestamp format.
        # Let's use a proper datetime object for psycopg2, it handles it well.
        published_at = datetime.now()

        cursor.execute(
            "INSERT INTO \"Video\" (youtube_video_id, channel_id, title, summary, published_at) VALUES (%s, %s, %s, %s, %s)",
            (video_id, channel_id, title, summary, published_at)
        )
        conn.commit()
        conn.commit()
        print("    - Saved to DB.")
        
        # Polite delay to avoid IP blocks - random 5-10 seconds with jitter
        delay = random.uniform(5, 10)
        print(f"    - Waiting {delay:.1f} seconds before next video...")
        time.sleep(delay)

    # Update channel last_updated
    cursor = conn.cursor()
    cursor.execute("UPDATE \"Channel\" SET last_updated = %s WHERE id = %s", (datetime.now(), channel_id))
    conn.commit()

def main():
    print("Starting Worker...")
    conn = get_db_connection()
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM \"Channel\"")
        channels = cursor.fetchall()
        
        for channel in channels:
            process_channel(conn, channel)
            
    except Exception as e:
        print(f"Worker Error: {e}")
    finally:
        conn.close()
    print("Worker Finished.")

if __name__ == "__main__":
    main()
