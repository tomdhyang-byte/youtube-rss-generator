import pg8000.dbapi
import ssl
from urllib.parse import urlparse
import os
import time
import random
from datetime import datetime
import scrapetube
from youtube_transcript_api import YouTubeTranscriptApi
from openai import OpenAI
from dotenv import load_dotenv
import feedparser
import requests
from dateutil import parser as date_parser

# Load environment variables
load_dotenv()

# Configuration
# Use DIRECT_URL for worker if available, otherwise DATABASE_URL
DATABASE_URL = os.getenv('DIRECT_URL') or os.getenv('DATABASE_URL')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
DEEPGRAM_API_KEY = os.getenv('DEEPGRAM_API_KEY')

if not OPENAI_API_KEY:
    print("Warning: OPENAI_API_KEY not found in environment variables. Summaries will be mocked or skipped.")

if not DEEPGRAM_API_KEY:
    print("Warning: DEEPGRAM_API_KEY not found in environment variables. Transcriptions will be skipped.")

client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

def get_db_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL/DIRECT_URL environment variable is not set")
    
    u = urlparse(DATABASE_URL)
    
    # Create SSL context that ignores verification errors (needed for some environments)
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    conn = pg8000.dbapi.connect(
        user=u.username,
        password=u.password,
        host=u.hostname,
        port=u.port,
        database=u.path[1:],
        ssl_context=ssl_context
    )
    return conn

def fetch_as_dict(cursor):
    "Return all rows from a cursor as a list of dicts"
    columns = [desc[0] for desc in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


# --- YouTube Logic ---

def fetch_youtube_transcript(video_id):
    try:
        api = YouTubeTranscriptApi()
        transcript_list = api.fetch(video_id, languages=['zh-TW', 'zh-Hant', 'zh-Hans', 'zh', 'en'])
        full_text = " ".join([t.text for t in transcript_list])
        return full_text
    except Exception as e:
        print(f"  - No YouTube transcript found or error: {e}")
        return None

def generate_summary(text, is_podcast=False):
    if not client:
        return "Summary not available (Missing OpenAI Key)."
    
    system_prompt = """你是一位資深的繁體中文內容分析師。請針對這段影片字幕進行「深度摘要」。
    
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
    system_prompt = """<Role>
你是一位「知識萃取與摘要專家」，擅長分析影片文字稿，將複雜資訊整理成清楚、可執行的洞見。

<Context>
你正在處理 YouTube 影片的文字稿，目標是萃取並組織最有價值的資訊，製作一份完整但精簡的摘要，保留內容核心、去除冗贅，並維持原始脈絡。

<Instructions>
1. 分析提供的文字稿，深度關注以下面向：
   - 主要主題與核心概念
   - 支持證據與範例（具體的數據或案例）
   - 可執行的重點建議
   - 獨特見解或觀點
   - 所呈現的方法論或框架

2. 處理資訊時請遵守：
   - 刪除重複內容並合併相關觀點
   - 保留關鍵的專業術語
   - 維持原始脈絡
   - 若有爭議性或可討論的觀點，請特別標註

<Constraints>
- 摘要字數控制在 1000 字以內
- 使用清楚、簡明的繁體中文
- 保持專業/分析師語氣
- 嚴格遵守下方的 HTML 格式回傳（因為要嵌入 RSS，絕不可使用 Markdown）

<Output Format>
請嚴格依據以下 HTML 結構輸出內容，不要添加額外的 Markdown 標記（如 ```html 或 **粗體**）：

<p><b>📝 執行摘要 (Executive Summary)：</b><br>
(請撰寫 2–3 句的精煉概述，說明影片核心價值與解決的問題。)</p>

<h3>🎯 主要重點 (Key Highlights)：</h3>
<ul>
    <li><b>重點 1：</b>(提煉關鍵點，並保留講者的邏輯。)</li>
    <li><b>重點 2：</b>(提煉關鍵點，並保留講者的邏輯。)</li>
    <li><b>重點 3：</b>(至少列出 3-5 點。)</li>
</ul>

<h3>💡 核心概念 (Core Concepts)：</h3>
<p>(詳細解析影片中的主要想法、方法論或是框架，這是讀者理解內容的基礎。)</p>

<h3>🔨 可執行建議 (Actionable Advice)：</h3>
<ul>
    <li><b>行動 1：</b>(具體的實務應用步驟。)</li>
    <li><b>行動 2：</b>(具體的實務應用步驟。)</li>
</ul>

<h3>🔍 額外洞見 (Extra Insights)：</h3>
<p>(分析講者的獨特觀點、隱含的假設，或是任何值得注意的細節與爭議點。)</p>"""

    if is_podcast:
        system_prompt = """<Role>
請擔任「Podcast 知識萃取與內容策展人」。你擅長處理長篇對話形式的逐字稿，能夠過濾閒聊與廣告，精準抓取講者（Host）與來賓（Guest）之間的思維火花，並將其轉化為結構化的深度筆記。

<Context>
你正在分析一份 Podcast 逐字稿。你的讀者是「追求高效學習的專業人士」，他們沒時間聽完 60 分鐘的音檔，但希望獲得如同親自聆聽般的深度啟發。重點在於「思維模型」、「具體策略」以及「推薦資源」。

<Instructions>
1. **內容過濾與重組：**
   - 自動過濾廣告、寒暄、口語贅字與無意義的重複。
   - 區分主持人與來賓的觀點，將對話轉化為邏輯清晰的論述。
   - 若對話過於發散，請依照「主題」而非「時間序」進行歸納。

2. **分析維度：**
   - **核心論點：** 本集試圖顛覆什麼觀念？或解決什麼問題？
   - **故事與案例：** 保留講者提到的具體故事（這是 Podcast 的靈魂）。
   - **金句（Quotes）：** 摘錄最具衝擊力或啟發性的原話。

<Constraints>
- 摘要字數控制在 1200 字以內
- 使用流暢、專業的繁體中文
- 嚴格遵守下方的 HTML 格式回傳（方便嵌入電子報或 RSS，絕不可使用 Markdown）
- 若逐字稿中有時間戳記，請在關鍵段落標註

<Output Format>
請嚴格依據以下 HTML 結構輸出內容，不要添加額外的 Markdown 標記（如 ```html）：

<p><b>🎙️ 節目小檔案 (The Brief)：</b><br>
(用 150 字以內摘要本集主題、來賓背景，以及這集適合什麼樣的人聽。)</p>

<h3>� 核心思維與洞察 (Key Mental Models)：</h3>
<ul>
    <li><b>觀點 1 - (自擬小標題)：</b>(詳細解釋這個概念。如果是對話形式，請歸納成「A 認為...而 B 補充了...」的綜述。保留具體案例。)</li>
    <li><b>觀點 2 - (自擬小標題)：</b>(同上，挖掘深度。)</li>
    <li><b>觀點 3 - (自擬小標題)：</b>(同上，挖掘深度。)</li>
</ul>

<h3>💬 值得銘記的金句 (Golden Quotes)：</h3>
<ul>
    <li><i>「(填寫引言內容)」</i> —— <b>(註明是誰說的)</b><br>(簡短補充這句話的背景或含義)</li>
    <li><i>「(填寫引言內容)」</i> —— <b>(註明是誰說的)</b></li>
</ul>

<h3>💡 總結與應用 (Takeaway)：</h3>
<p>(聽完這集後，讀者明天上班或生活中可以立即嘗試的一個小改變是什麼？)</p>"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o", # Upgraded to gpt-4o for better quality
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"內容如下：\n\n{text[:100000]}"} 
            ]
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"  - OpenAI API Error: {e}")
        return "Summary generation failed."

def process_youtube_channel(conn, channel):
    channel_id = channel['id']
    youtube_id = channel['youtube_id']
    channel_title = channel['title']
    
    print(f"Processing YouTube Channel: {channel_title} ({youtube_id})")
    
    # Update Channel Metadata if needed
    if channel_title == 'New Channel' or channel['description'] == 'Waiting for worker to update...':
        pass 

    print("  - Fetching video list from YouTube...")
    try:
        videos = scrapetube.get_channel(channel_id=youtube_id, limit=3)
        print("  - Video list fetched.")
    except Exception as e:
        print(f"  - Error fetching videos: {e}")
        return

    first_video = True
    for video in videos:
        video_id = video['videoId']
        title = video['title']['runs'][0]['text']
        print(f"  - Checking video: {title} ({video_id})")
        
        if first_video and (channel_title == 'New Channel'):
             try:
                 new_title = video.get('ownerText', {}).get('runs', [{}])[0].get('text')
                 if not new_title:
                     new_title = video.get('shortBylineText', {}).get('runs', [{}])[0].get('text')
                 
                 if new_title:
                     print(f"    - Found real channel title: {new_title}")
                     cursor = conn.cursor()
                     cursor.execute("UPDATE youtube_channels SET title = %s, description = %s WHERE id = %s", 
                                  (new_title, "Updated by worker", channel_id))
                     conn.commit()
                     channel_title = new_title 
             except Exception as e:
                 print(f"    - Could not extract channel title from video: {e}")
        first_video = False
        
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM youtube_videos WHERE youtube_video_id = %s", (video_id,))
        if cursor.fetchone():
            print(f"    - Video already exists, skipping.")
            continue
            
        print(f"    - New Video found: {title}")
        
        print("    - Fetching transcript...")
        transcript = fetch_youtube_transcript(video_id)
        summary = "No transcript available."
        
        if transcript:
            print("    - Transcript fetched. Generating summary...")
            summary = generate_summary(transcript, is_podcast=False)
            print("    - Summary generated.")
        
        published_at = datetime.now()

        cursor.execute(
            "INSERT INTO youtube_videos (youtube_video_id, channel_id, title, summary, published_at) VALUES (%s, %s, %s, %s, %s)",
            (video_id, channel_id, title, summary, published_at)
        )
        conn.commit()
        print("    - Saved to DB.")
        
        delay = random.uniform(5, 10)
        print(f"    - Waiting {delay:.1f} seconds before next video...")
        time.sleep(delay)

    cursor = conn.cursor()
    cursor.execute("UPDATE youtube_channels SET last_updated = %s WHERE id = %s", (datetime.now(), channel_id))
    conn.commit()

# --- Podcast Logic ---

def transcribe_audio(audio_url):
    if not DEEPGRAM_API_KEY:
        return None
    
    url = "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&detect_language=true"
    headers = {
        "Authorization": f"Token {DEEPGRAM_API_KEY}",
        "Content-Type": "application/json"
    }
    data = {"url": audio_url}
    
    try:
        print(f"    - Calling Deepgram for: {audio_url}")
        response = requests.post(url, headers=headers, json=data, timeout=600) # 10 min timeout for long audio
        response.raise_for_status()
        result = response.json()
        
        # Extract transcript
        transcript = result.get('results', {}).get('channels', [{}])[0].get('alternatives', [{}])[0].get('transcript', '')
        return transcript
    except Exception as e:
        print(f"    - Deepgram Error: {e}")
        return None

def process_podcast_channel(conn, podcast):
    podcast_id = podcast['id']
    feed_url = podcast['feed_url']
    podcast_title = podcast['title'] or "Unknown Podcast"
    
    print(f"Processing Podcast: {podcast_title} ({feed_url})")
    
    try:
        response = requests.get(feed_url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=30)
        response.raise_for_status()
        feed = feedparser.parse(response.content)
    except Exception as e:
        print(f"  - Error parsing RSS: {e}")
        return

    # Update podcast metadata if missing
    if not podcast['title'] and feed.feed.get('title'):
        new_title = feed.feed.get('title')
        new_desc = feed.feed.get('description', '')
        new_site = feed.feed.get('link', '')
        new_image = feed.feed.get('image', {}).get('href', '')
        
        print(f"  - Updating podcast metadata: {new_title}")
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE podcast_channels 
            SET title = %s, description = %s, site_url = %s, image_url = %s 
            WHERE id = %s
        """, (new_title, new_desc, new_site, new_image, podcast_id))
        conn.commit()

    # Process episodes (limit 3 latest)
    for entry in feed.entries[:3]:
        guid = entry.get('guid', entry.get('link'))
        title = entry.get('title', 'Untitled Episode')
        
        # Find audio URL
        audio_url = None
        for enclosure in entry.get('enclosures', []):
            if enclosure.get('type', '').startswith('audio'):
                audio_url = enclosure.get('href')
                break
        
        if not audio_url:
            print(f"  - No audio found for: {title}, skipping.")
            continue

        print(f"  - Checking episode: {title}")
        
        # Check if exists
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM podcast_episodes WHERE podcast_id = %s AND guid = %s", (podcast_id, guid))
        if cursor.fetchone():
            print(f"    - Episode already exists, skipping.")
            continue
            
        print(f"    - New Episode found: {title}")
        
        # Transcribe
        print("    - Transcribing audio...")
        transcript = transcribe_audio(audio_url)
        summary = "No transcript available."
        
        if transcript:
            print(f"    - Transcript fetched ({len(transcript)} chars).")
            
            # Truncate if too long
            if len(transcript) > 200000:
                print("    - Transcript too long, truncating...")
                transcript = transcript[:200000] + "...(truncated)"
            
            print("    - Generating summary...")
            summary = generate_summary(transcript, is_podcast=True)
            print("    - Summary generated.")
        
        # Parse published_at
        published_at = datetime.now()
        if hasattr(entry, 'published_parsed') and entry.published_parsed:
             published_at = datetime.fromtimestamp(time.mktime(entry.published_parsed))
        elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
             published_at = datetime.fromtimestamp(time.mktime(entry.updated_parsed))

        cursor.execute(
            """INSERT INTO podcast_episodes 
               (podcast_id, guid, title, audio_url, transcript, summary, published_at) 
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (podcast_id, guid, title, audio_url, transcript, summary, published_at)
        )
        conn.commit()
        print("    - Saved to DB.")
        
        delay = random.uniform(5, 10)
        print(f"    - Waiting {delay:.1f} seconds before next episode...")
        time.sleep(delay)

    cursor = conn.cursor()
    cursor.execute("UPDATE podcast_channels SET last_updated = %s WHERE id = %s", (datetime.now(), podcast_id))
    conn.commit()

def main():
    print("Starting Worker...")
    print("Connecting to database...")
    conn = get_db_connection()
    print("Database connected.")
    
    try:
        # 1. Process YouTube Channels
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM youtube_channels")
        channels = fetch_as_dict(cursor)
        for channel in channels:
            process_youtube_channel(conn, channel)
            
        # 2. Process Podcast Channels
        cursor.execute("SELECT * FROM podcast_channels")
        podcasts = fetch_as_dict(cursor)
        for podcast in podcasts:
            process_podcast_channel(conn, podcast)
            
    except Exception as e:
        print(f"Worker Error: {e}")
    finally:
        conn.close()
    print("Worker Finished.")

if __name__ == "__main__":
    main()
