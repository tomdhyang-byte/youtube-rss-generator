"""
Summarization Module
Handles AI summary generation using OpenAI.
"""
from .config import OPENAI_API_KEY

# Lazy-loaded OpenAI client
_client = None


def _get_client():
    """Lazy initialization of OpenAI client."""
    global _client
    if _client is None and OPENAI_API_KEY:
        from openai import OpenAI
        _client = OpenAI(api_key=OPENAI_API_KEY)
    return _client

# --- Prompts ---

YOUTUBE_SUMMARY_PROMPT = """<Role>
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
    <li><b>行動 3：</b>(具體的實務應用步驟。)</li>
</ul>

<h3>🔍 額外洞見 (Extra Insights)：</h3>
<p>(分析講者的獨特觀點、隱含的假設，或是任何值得注意的細節與爭議點。)</p>"""

PODCAST_SUMMARY_PROMPT = """<Role>
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

<h3>🧠 核心思維與洞察 (Key Mental Models)：</h3>
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


def generate_summary(text: str, is_podcast: bool = False) -> str:
    """
    Generate an AI summary of the transcript using OpenAI.
    
    Args:
        text: The transcript text to summarize
        is_podcast: Whether to use podcast-specific prompt
        
    Returns:
        The generated summary or an error message
    """
    client = _get_client()
    if not client:
        return "Summary not available (Missing OpenAI Key)."
    
    system_prompt = PODCAST_SUMMARY_PROMPT if is_podcast else YOUTUBE_SUMMARY_PROMPT

    try:
        response = client.chat.completions.create(
            model="gpt-4.1",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"內容如下：\n\n{text[:100000]}"} 
            ]
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"  - OpenAI API Error: {e}")
        return "Summary generation failed."
