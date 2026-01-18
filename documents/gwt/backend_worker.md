# Backend Worker GWT & Architecture Spec

> **Purpose**: 此文件包含後端 Worker 的「架構概覽」與「行為規範 (GWT)」，供 AI 對話時提供完整的 Context。

---

## 🏗 Backend Worker Architecture Overview

後端是一個 Python Daemon，核心職責是「將外部內容 (YouTube/Podcast) 轉換為我們資料庫中的標準格式 (Video/Summary)」。

**Data Flow:**
1.  **Trigger**: API 觸發 (用戶訂閱) 或 Timer 觸發 (每小時維護)。
2.  **Dispatch**: Daemon 根據任務類型 (`YOUTUBE` | `PODCAST`) 派發給對應的處理器。
3.  **Fetch**: 每個處理器去外部撈取「最新 3 筆」內容。
4.  **Transcribe**: 取得文字稿 (Transcript)。
5.  **Summarize**: 根據用戶需求 (Style+Language) 生成摘要。
6.  **Persist**: 寫入 DB 並鎖定用戶當下的 Style 設定。

### ⚖️ YouTube vs Podcast：共用與差異

| 功能模組 | 🔴 YouTube 實作 | 🟣 Podcast 實作 | 🤝 共用/差異點 |
| :--- | :--- | :--- | :--- |
| **資料來源 (Source)** | YouTube RSS + Scrapetube (備援) | 標準 RSS Feed (Feedparser) | **差異**：YT 需抗爬蟲機制 |
| **Shorts 過濾** | **有** (過濾 <60s 或重定向檢查) | **無** (Podcast 沒這問題) | **差異**：YT 專屬邏輯 |
| **Transcript 取得** | **Multi-tier Fallback**<br>1. Free API<br>2. Supadata<br>3. yt-dlp + Whisper API | **Deepgram (URL)**<br>直接傳音檔 URL 不下載 | **差異**：YT 較複雜，Podcast 較單純 |
| **API 限制 (Limit)** | 3 部影片 | 3 集單集 | **共用**：邏輯一致 (代碼分開) |
| **摘要生成 (AI)** | `generate_summary()` | `generate_summary()` | **共用**：Prompt 結構相同 |
| **風格鎖定 (Lock)** | `lock_user_styles()` | `lock_user_styles()` | **共用**：核心 Design B 邏輯 |
| **補產摘要 (Backfill)** | `ensure_missing_summaries` | `ensure_missing_summaries` | **共用**：應付多語言/風格需求 |
| **Tier 限制** | `common.py` | `common.py` | **共用**：限制訂閱數量 |

---

## Daemon (daemon.py) - 任務調度引擎

### Task Polling
> **Rationale**: 確保多個 Worker 同時運作時，不會搶同一個任務來做。一旦選中，立刻貼上 "處理中" 標籤，避免重工。

```gherkin
Given 隊列中有 status='PENDING' 的任務
When Daemon 每 10 秒輪詢一次
Then 選取 priority 最高、createdAt 最早的任務
And 將該任務標記為 'PROCESSING'
```

### Stuck Task Recovery
> **Rationale**: 防止因為程式當機 (Crash) 導致任務永遠卡在 "處理中"。若超過 5 分鐘沒動靜，視為當機，重設狀態讓別人接手。

```gherkin
Given 任務已處於 'PROCESSING' 超過 threshold (預設 5 分鐘)
When Daemon 啟動時檢查
Then 將該任務重設為 'PENDING'
And 記錄 Warning 日誌
```

### Task Execution
> **Rationale**: 節省資源。如果一個頻道已經沒人訂閱了，就不需要浪費 API 額度去抓它的新影片。

```gherkin
Given 取得 YOUTUBE 或 PODCAST 類型任務
When 執行 process_task()
Then 先檢查該 entity 是否有活躍訂閱者
  - 若無 → 標記 'SKIPPED'
  - 若有 → 執行對應 processor
And 成功時標記 'COMPLETED'，失敗時標記 'FAILED' + errorMessage
```

### Routine Maintenance
> **Rationale**: 服務「已在訂閱中」的人。因為舊訂閱不會被加入即時處理隊列 (Processing Queue)，所以需要每小時執行一次全域掃描，主動檢查所有訂閱頻道是否有新內容，確保 feed 持續更新。

```gherkin
Given 距離上次 maintenance 超過 MAINTENANCE_INTERVAL
When 處理完當前任務或空閒時
Then 執行 legacy full scan (worker.py main())
```

---

## YouTube Processing (youtube.py) - 頻道處理

### New Video Detection
> **Rationale**: 
> 1. 設定 "3 部" 上限是為了平衡「API 成本」與「漏抓風險」(避免同時上傳導致只抓到一部)。
> 2. 過濾 Shorts 是為了專注長影片摘要，且 Shorts 通常沒有高品質 Transcript。

```gherkin
Given 已訂閱的 YouTube Channel
When Worker 處理該頻道時
Then 透過 RSS 或 Scrapetube 獲取 "最新 3 部" 影片 (Hard Limit)
And 若有同時上傳的多部影片，現在能抓到最新 3 部以內的
And 過濾掉 Shorts (duration < 60s 或 redirect check)
```

### Backfill & Trigger Mechanism
> **Rationale**: 
> 1. 用戶訂閱時 "立即觸發" 是為了提供即時回饋感。
> 2. "不回溯舊影片" 是為了節省巨額 API 成本。假設一個頻道有 1000 部舊片，如果全部補產摘要會瞬間破產。

```gherkin
Given 用戶新增訂閱或 Worker 定期輪詢
Then 立即觸發 Worker 任務 (Priority=10)
And Worker 只檢查 feed 中 "最新 3 部" 影片是否已在 DB
And 若該影片已存在但缺目前用戶的 (style, language) → 執行 backfill
And ⚠️ 警告：舊影片 (第 2 部以後) 不會被回溯補齊摘要
```

### Transcript Fetching (Multi-tier Fallback)
> **Rationale**: 成本優化策略。優先用免費的方法，失敗了才用付費 API (Supadata)，再失敗才用最貴的自建轉錄 (OpenAI Whisper)。

```gherkin
Given 新影片需要轉錄
When 嘗試獲取 transcript
Then 依序嘗試:
  1. Free API (youtube-transcript-api) - 每日 10 次限制，且 10 次之間設有冷卻時間，避免 IP 被抓
  2. Supadata API (付費備援)
  3. yt-dlp + OpenAI Whisper API (Audio Upload)
And 若全部失敗 → 跳過該影片，不產生摘要
```

### Style-Based Summary Generation
> **Rationale**: 
> "On-Demand" 生成。只有當真的有人訂閱 "詳細/英文" 版時，我們才去生成那一種摘要。避免預先生成沒人看的組合，浪費錢。

```gherkin
Given 影片有 transcript
And 訂閱者有多種 (style, language) 組合需求
When 產生摘要時
Then 針對每個 demanded combo 呼叫 generate_summary()
And 存入 video_summaries 表 (唯一索引: video_id + style + language)
```

### Locked Style Mechanism (Design B)
> **Rationale**: 
> 確保 "歷史一致性"。用戶今天看到的摘要，不會因為明天改了設定而變樣。改動設定之後，只針對未來的摘要做變動，這讓 RSS Feed 的內容是穩定、可預期的。

```gherkin
Given 影片摘要產生完成
When lock_user_styles() 被呼叫
Then 為每個訂閱者在 user_video_styles 表建立記錄
And 記錄當時的 style + language
And 使用 ON CONFLICT DO NOTHING 避免覆蓋既有鎖定
```

### Missing Summary Backfill
> **Rationale**: 
> 語言＆摘要風格是一個排列組合，如果有兩種語言兩種摘要風格，那就代表最多會有四種 feed，系統需要確保每種 feed 都有完整摘要。

```gherkin
Given 既有影片
And 新訂閱者使用不同的 (style, language) 組合
When ensure_missing_summaries() 被呼叫
Then 比對 demanded_combos vs existing_summaries
And 針對缺少的 combo 即時生成補齊
```

---

## Podcast Processing (podcast.py) - Podcast 處理

### Episode Detection
> **Rationale**: 與 YouTube 邏輯同步。抓最新 3 集是為了容錯 (避免漏抓)，以及讓新訂閱的用戶有多一點東西可以看。

```gherkin
Given 已訂閱的 Podcast Feed
When Worker 處理該 podcast 時
Then 解析 RSS feed (feedparser)
And 只處理最新 3 集 episode (與 YouTube 同步)
And 提取 audio_url (enclosure type=audio/*)
```

### Audio Transcription
> **Rationale**: Podcast 沒有字幕，必須依賴 AI 聽打。Deepgram 是目前性價比與速度的最佳平衡點。

```gherkin
Given Episode 有 audio_url
Then 使用 Deepgram API 進行轉錄 (直接傳入 URL，不需下載音檔)
And 若 transcript 超過 200k 字元 → 截斷
```

### Summary & Lock (Same as YouTube)
> **Rationale**: 保持體驗一致性。Podcast 的摘要生成、鎖定、補產邏輯，完全沿用 YouTube 的成熟機制。

```gherkin
Given Episode transcript 已準備
Then 依照與 YouTube 相同的邏輯:
  - 產生 demanded combo 摘要
  - lock_user_styles() 到 user_episode_styles 表
  - ensure_missing_summaries() 補齊缺漏
```

---

## Common Utilities (common.py) - 共用邏輯

### Tier-Based Limits
> **Rationale**: 商業模式的基礎。確保免費用戶不能濫用資源，付費用戶能享有更多權益。

```gherkin
Given 用戶有 tier (FREE/PLUS/PRO)
When get_effective_tier() 被呼叫
Then 檢查 tier_expires_at 是否已過期
  - 若過期 → 返回 'FREE'
  - 若未過期 → 返回原 tier
```

### Subscription Limit Check
> **Rationale**: 防止單一用戶訂閱過多頻道，導致系統資源耗盡。

```gherkin
Given 用戶有 N 個訂閱
And 用戶 tier 限制為 M
When is_subscription_active(index) 被呼叫
Then 返回 index < M (0-based)
```

---

## Appendix: Operations & Troubleshooting

> **Rationale**: 提供運維與除錯的 SOP，確保 Worker 發生問題時能快速恢復。

### 🚨 Common Alerts & Fixes

**1. "Processing" Stuck Forever (Zombie Tasks)**
*   **Symptom**: UI 上的轉圈圈持續超過 10 分鐘以上。
*   **Cause**: Worker 在執行任務中途崩潰 (Crash, OOM, Kill)，沒機會把狀態改回 `FAILED`。
*   **Fix**: Daemon 啟動時會自動執行 `recover_stuck_tasks()`。若需手動修復：
    ```sql
    UPDATE processing_queue SET status = 'PENDING' WHERE status = 'PROCESSING';
    ```

**2. HTTP 429 / 403 (YouTube API)**
*   **Symptom**: Logs 出現 `googleapiclient.errors.HttpError: ... "quotaExceeded"`.
*   **Cause**: 當日 YouTube Data API Quota (10,000 units) 用完了。
*   **Action**: 只能等太平洋時間午夜已被重置 (PT Midnight)。
*   **Prevention**: 檢查 `config.py` 中的 `daily_limit` 是否開啟保護。

**3. Database Connection Failed**
*   **Symptom**: `psycopg2.OperationalError`
*   **Cause**: 網路瞬斷或 DB 服務暫停 (Supabase Paused)。
*   **Fix**: Worker 內建 retry 機制，通常會自動恢復。若持續失敗，重啟 Worker 容器。

### 🛠 Operational Commands

**Start Worker (Daemon)**
```bash
python3 -m backend.worker.daemon
```

**Run Unit Tests**
```bash
# 部署改動前，請務必執行
python -m pytest tests/ -v
```

**Logs Checking**
```bash
tail -f execution_status.log
```
