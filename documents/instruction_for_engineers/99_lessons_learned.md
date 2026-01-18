# AI 錯誤記錄與教訓

> **每次改動前必讀！** 這份文件記錄了過去犯過的錯誤。

---

## 🔴 錯誤記錄

### 2026-01-01: 型別更新不完整導致 Build 失敗

**情境**：
- 更新 API 回傳結構（加入 `tier` 欄位）
- 更新使用端的 interface（`QuotaProvider.tsx`）
- 但漏改**中間層**的型別定義（`useSubscriptions.ts`）

**根因**：
- Merge conflict 時 remote 有重構，`QuotaProvider` 改為依賴 `useSubscriptions`
- 沒注意到這個依賴關係變化

**教訓**：
1. 修改 API 回傳時，追蹤完整的 **型別依賴鏈**
2. Merge conflict 後，檢查 remote 變更是否影響自己的檔案
3. Push 前執行 `npm run build`，不要只用 `tsc --noEmit`

**相關檔案**：
- `app/api/subscriptions/route.ts` → `hooks/useSubscriptions.ts` → `components/providers/QuotaProvider.tsx`

---

### 2026-01-01: 手動定義的 Type 沒有同步更新

**情境**：
- 在 `prisma/schema.prisma` 加入 `ADMIN` 到 `SubscriptionTier` enum
- 在 `TIER_LIMITS` 常量加入 `ADMIN: Infinity`
- 但忘記更新 **手動定義的 TypeScript type**

**根因**：
- `lib/types/subscription-tier.ts` 中的 `SubscriptionTier` 是手動定義的 union type（不是從 Prisma 自動生成）
- 只加了 `ADMIN` 到使用處，沒加到類型定義本身

**教訓**：
1. 區分「手動定義的類型」和「自動生成的類型」
2. 手動類型需要**同步手動更新**
3. 本地 lint 看不到問題不代表 build 會成功

**相關檔案**：
- `lib/types/subscription-tier.ts` (line 8: `export type SubscriptionTier = ...`)

---

## 🟡 一般教訓

### Timeouts
- Vercel Serverless Functions 有 10s (standard) 或 60s (pro) timeout
- 長時間任務必須透過 Background Worker (`backend/worker`)，不要在 API call 中 blocking

### SSRF
- 永遠使用 `lib/security.ts` 驗證用戶提供的 URL

### Optimistic UI
- 使用 `react-query` 的 `onMutate` 做樂觀更新
- Debug「閃爍」問題時，檢查 `onMutate` 是否正確更新 cache，以及 `onError` rollback 是否誤觸發

### i18n
- 所有 user-facing text 必須在 `messages/*.json` 中
- 不要在 components 中 hardcode 字串

### Prompt Engineering
- 修改 `summarize.py` 的 prompts 可能破壞 JSON parsing
- 永遠強制 strict output format，並在 prompt 變更後測試

### Virtual Environment CLI Tools
- 直接呼叫 `.venv/bin/python3` **不等於**啟用虛擬環境
- 如果 Python 用 `subprocess.run(["yt-dlp", ...])` 呼叫 CLI 工具，系統會去 `$PATH` 找，而不是 `.venv/bin`
- **解法**：腳本中用 `source .venv/bin/activate` 才能讓 CLI 工具可用
- 相關檔案：`backend/run_worker.sh`

### YouTube Rate Limits
- `youtube-transcript-api` 太頻繁會被 IP ban
- Worker 有內建 cooldown logic，不要移除 `sleep` calls

---

## ✅ 每次改動前的檢查清單

- [ ] API 回傳型別變更時，是否更新了所有使用該 API 的 hook/type 定義？
- [ ] Merge conflict 後，是否理解 remote 的變更內容？
- [ ] 是否執行 `npm run build` 確認編譯通過？
- [ ] 修改 prompts 後，是否測試了 output format？
- [ ] 修改 Python backend 後，是否執行 `python -m pytest tests/ -v` 確認測試通過？
- [ ] 修改 services/ 或 worker/ 後，是否驗證 imports 正確？（`python -c "from backend.worker.youtube import process_youtube_channel"`）

### 2026-01-18: God Module 重構模式 (Service Layer Extraction)

**情境**：
- `backend/worker/youtube.py` 膨脹到 416 行，同時處理：編排邏輯、RSS/Scrapetube 抓取、時間解析、Shorts 偵測、音訊下載等。
- 難以單獨測試各個功能。

**解決方案**：
- 建立 `backend/services/` 目錄作為 Service Layer
- 將純資料抓取邏輯移到 `youtube_metadata.py`（4 個 functions）
- 將音訊下載邏輯移到 `transcribe.py`（與其他轉錄邏輯放一起）
- `youtube.py` 只保留 ~200 行的編排邏輯

**教訓**：
1. **Service Layer 模式**：純函數放 `services/`，有副作用的編排放 `worker/`
2. **測試優先**：移動函數後立即寫 unit tests 驗證行為不變
3. **漸進式重構**：分 Phase 執行，每個 Phase 後驗證 imports 和 integration

**相關檔案**：
- `backend/services/youtube_metadata.py` (NEW)
- `backend/worker/youtube.py` (416 → 197 lines)
- `backend/worker/transcribe.py` (+43 lines)
- `tests/test_youtube_metadata.py` (22 tests)
- `tests/test_transcribe.py` (6 tests)
- `instructions/technical/refactor_youtube_py.md` (完整重構計畫)

---

### 2026-01-15: 數據隔離不完整導致的語言洩漏 (Language Leak)

**情境**：
- 系統設計支援多語言摘要（繁中、英文）。
- 資料庫有 `episode_summaries` 表，用 `(episode_id, style, language)` 作為 key。
- 用戶在 RSS Reader 看到英文摘要，但其設定是中文。

**根因**：
- 在 SQL JOIN 時，只用了 `style` 條件，漏了 `language` 條件。
- 錯誤寫法：`INNER JOIN episode_summaries es ON es.episode_id = e.id AND es.style = ues.style`
- 結果：資料庫同時有中英文摘要時，JOIN 結果會隨機返回其中一個（通常是先建立的那個），導致語言洩漏。

**教訓**：
1. **多維度資料的 JOIN**：當資料表有多個維度（如 Style + Language）作為主鍵時，JOIN **必須**包含所有維度。
2. **複製貼上的代價**：Per-podcast feed 的路由是從舊版複製的，當時還沒有語言功能，導致 bug 被複製到多個檔案。
3. **全面搜尋**：當 Schema 增加新維度（如 adding `language` column）時，必須全域搜尋該表的所有 SQL Query 並更新 JOIN 條件。

**相關檔案**：
- `app/[locale]/feed/user/[token]/route.ts`
- `app/[locale]/feed/user/[token]/podcast/[podcastId]/route.ts`
