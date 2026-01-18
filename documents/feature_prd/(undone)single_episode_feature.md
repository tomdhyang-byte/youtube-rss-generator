# 單集摘要功能 PRD

> **目標**：讓已登入使用者可以貼上「單集」YouTube 影片或 Podcast 單集連結，立即產生 AI 摘要，無需訂閱整個頻道。

---

## 🎯 核心價值

```
使用者發現有趣的單集 → 貼上連結 → 登入後獲得 AI 摘要 → 決定是否訂閱頻道
```

### 功能比較

| 維度 | 訂閱頻道 | 單集摘要 |
|------|---------|---------|
| 內容追蹤 | 自動追蹤新內容 | 一次性處理 |
| 風格/語言設定時機 | 訂閱完成後可調整 | **貼上時即選擇** |
| 數量限制 | 依 Tier (頻道數) | **每用戶最多 50 集** |
| 超出處理 | 無法新增 | **FIFO 自動刪除最舊** |
| 訪客支援 | ✅ 可貼上但需登入看摘要 | ✅ 可貼上但需登入看摘要 |

---

## 🚦 建議執行順序（Handover Guide）

### 實作階段總覽

```
Phase 1 ──> Phase 2A ──┬──> Phase 3 ──> Phase 4 ──> Phase 5 ──> Phase 6
(Schema)    (Frontend) │    (API)       (UI)        (整合)      (部署)
            Phase 2B ──┘
            (Worker)
```

### Phase 1：資料庫 Schema（Day 1）

> ⚠️ **阻塞點**：所有後續工作都依賴此階段完成

| 任務 | 檔案 | 產出 |
|-----|------|------|
| 新增 `SingleEpisodeStatus` enum | `prisma/schema.prisma` | ✅ |
| 新增 `UserSingleEpisode` model | `prisma/schema.prisma` | ✅ |
| 擴充 `QueueType` enum | `prisma/schema.prisma` | ✅ |
| 擴充 `ProcessingQueue` 欄位 | `prisma/schema.prisma` | ✅ |
| 新增 DB check constraint | `prisma/migrations/xxx/migration.sql` | ✅ |
| 執行 migration | `npx prisma migrate dev` | ✅ |

**驗收**：`npx prisma studio` 可看到新 table

---

### Phase 2A：前端 Service 層（Day 2-3）

> 可與 Phase 2B 平行開發

| 任務 | 檔案 | 依賴 |
|-----|------|------|
| URL 解析器 | `lib/services/urlParser.ts` | ✅ |
| URL 解析測試 | `lib/services/__tests__/urlParser.test.ts` | ✅ |
| 單集 Service | `lib/services/singleEpisode.ts` | ✅ |
| 單集 Service 測試 | `lib/services/__tests__/singleEpisode.test.ts` | ✅ |
| 型別定義 | `lib/types.ts` | ✅ |

**驗收**：所有單元測試通過

---

### Phase 2B：Worker 處理邏輯（Day 2-4）

> 可與 Phase 2A 平行開發

| 任務 | 檔案 | 依賴 |
|-----|------|------|
| 單集處理 Worker | `backend/worker/single.py` | ✅ |
| 錯誤分類邏輯 | `backend/worker/single.py` | ✅ |
| Daemon 整合 | `backend/worker/daemon.py` | ✅ |
| Worker 測試 | `backend/worker/tests/test_single.py` | ❌ 未見檔案 |

**驗收**：本地測試 Worker 可處理 `SINGLE_VIDEO` 類型任務

---

### Phase 3：API 層（Day 4-6）

> 依賴 Phase 1 + Phase 2A

| 任務 | 檔案 | 優先級 |
|-----|------|--------|
| POST /api/single-episode | `app/api/single-episode/route.ts` | ✅ (Podcast 待實作) |
| GET /api/single-episodes | `app/api/single-episodes/route.ts` | ✅ |
| DELETE /api/single-episodes/[id] | `app/api/single-episodes/[id]/route.ts` | ✅ |
| POST retry | `app/api/single-episodes/[id]/retry/route.ts` | ✅ |
| API 整合測試 | `app/api/*/__tests__/*.test.ts` | ❌ 未見檔案 |

**驗收**：Postman / curl 可成功呼叫各 API

---

### Phase 4：前端 UI（Day 6-9）

> 依賴 Phase 3

| 任務 | 檔案 | 說明 |
|-----|------|------|
| useSingleEpisodes Hook | `hooks/useSingleEpisodes.ts` | ✅ |
| 統一搜尋欄重構 | `components/subscription/ChannelManager/UnifiedAddForm.tsx` | ✅ (新檔案) |
| 模式選擇器 | `components/subscription/ModeSelector.tsx` | ✅ |
| 狀態顯示元件 | `components/subscription/SingleEpisodeStatus.tsx` | ✅ (新檔案) |
| 收藏單集 Tab | 現有 Feed 頁面 | ❌ 未實作（Phase 5 工作） |
| i18n 翻譯 | `messages/en.json`, `messages/zh-TW.json` | ✅ (約27鍵值) |

**驗收**：可在 UI 完成完整流程（貼 URL → 看到處理中 → 看到摘要）

---

### Phase 5：整合與 Polish（Day 9-10）

| 任務 | 檔案 | 說明 |
|-----|------|------|
| ALL Tab 混合顯示 | `hooks/useFeed.ts`, `app/api/feed/route.ts` | ✅ (已支援 'single' filter) |
| UI 識別標記 | Feed 元件 | ✅ (`isSingleEpisode` flag) |
| Edge cases 處理 | 各檔案 | ❌ 未驗證 |
| 手動 E2E 測試 | - | ❌ 未執行 |

**驗收**：所有 P0 驗收標準通過

---

### 🧪 測試檢查清單

> **狀態說明**：Mac Mini 舊 Worker 會將未知任務類型（`SINGLE_VIDEO`）標記為 `PROCESSING` 後卡死 30 分鐘。因此部分測試需等待 Worker 更新。

#### ✅ 現在可測試（無需 Mac Mini 更新）

| # | 測試項目 | 測試方式 | 狀態 |
|---|---------|---------|------|
| 1 | **ModeSelector 下拉選單** | `npm run dev` → 訂閱頁面 | ✅ |
| 2 | **統一搜尋欄 UI** | 切換三種模式，確認 placeholder 變化 | ✅ |
| 3 | **單集設定選項顯示** | 選擇「產生單集摘要」模式，確認 Style/Language 選擇器出現 | ✅ |
| 4 | **URL 解析驗證** | 貼上有效 YouTube URL，確認無錯誤訊息 | ✅ |
| 5 | **Shorts URL 拒絕** | 貼上 YouTube Shorts URL，確認顯示錯誤 | ⬜ |
| 6 | **Feed 頁面「收藏單集」Tab** | 確認 Tab 存在且可切換 | ✅ |

**測試環境設定**：
```bash
# 複製範本並設定
cp .env.local.example .env.local
# 編輯 .env.local，設定 ENABLE_SINGLE_EPISODE=true
npm run dev
```

---

#### ⏳ 需要更新 Mac Mini Worker 後測試

| # | 測試項目 | 預期結果 | 狀態 |
|---|---------|---------|------|
| 1 | **已登入用戶貼上 YouTube 影片連結** | API 返回 `queued`，DB 寫入 `UserSingleEpisode` | ⬜ |
| 2 | **處理佇列任務建立** | `ProcessingQueue` 新增 `SINGLE_VIDEO` 記錄 | ⬜ |
| 3 | **Worker 處理完成** | 狀態從 `PENDING` → `PROCESSING` → `COMPLETED` | ⬜ |
| 4 | **摘要可見** | Feed 頁面「收藏單集」Tab 顯示摘要內容 | ⬜ |
| 5 | **重試失敗任務** | `FAILED` 狀態的任務可重試，狀態重設為 `PENDING` | ⬜ |
| 6 | **50 筆 FIFO 刪除** | 第 51 筆會自動刪除最舊的一筆 | ⬜ |
| 7 | **ALL Tab 混合顯示** | 單集摘要與頻道摘要混合排序顯示 | ⬜ |
| 8 | **Feature Flag 阻擋** | 不設定 `ENABLE_SINGLE_EPISODE`，API 返回 503 | ⬜ |

---

### Phase 6：部署（Day 11）

> ⚠️ 需要存取 Mac Mini

| 順序 | 任務 | 指令 |
|-----|------|------|
| 1 | 停止 Mac Mini Worker | `pkill -f "python.*daemon"` |
| 2 | 更新程式碼 | `git pull origin main` |
| 3 | 執行 migration（若未執行） | `npx prisma db push` |
| 4 | 重啟 Worker | `python3 -m backend.worker.daemon` |
| 5 | **開啟 Feature Flag** | **前往 Vercel 後台 > Enviroment Variables > 新增 `ENABLE_SINGLE_EPISODE=true`** |
| 6 | 部署前端 | Push to main (Vercel 會自動重新部署以讀取新變數) |
| 7 | 驗證 | 對照部署驗證清單 |

> **💡 Feature Flag 管理備註**：
> *   **上線初期**：請保持 Vercel 的變數存在 (`true`)，以作為緊急開關。若發生嚴重問題，刪除此變數即可瞬間關閉功能。
> *   **穩定後期**：確認功能穩定後，可再請工程師移除程式碼中的 Flag 檢查邏輯，屆時才將環境變數移除。

---

### 里程碑定義

| 里程碑 | 完成條件 | 預估時間 |
|-------|---------|---------|
| M1：可 Demo | Phase 1-3 完成，可用 Postman 打 API | Day 6 |
| M2：可內測 | Phase 4 完成，UI 流程可走通（Feature Flag 關閉） | Day 9 |
| M3：可上線 | Phase 5-6 完成，所有驗收標準通過 | Day 11 |

---

### 交接檢查清單

工程師接手前，請確認：

- [ ] 已閱讀完整 PRD（特別是 §4 風格衝突、§7 錯誤處理、§10 顯示邏輯）
- [ ] 已理解現有架構（`youtube_metadata.py`、`transcribe.py`、`summarize.py`）
- [ ] 有 Mac Mini SSH 存取權限（Phase 6 需要）
- [ ] 有 Vercel Dashboard 存取權限（設定 Feature Flag）
- [ ] 本地開發環境可執行 `npm run dev` 和 `python -m backend.worker.daemon`

---

### 風險與注意事項

| 風險 | 影響 | 緩解措施 |
|-----|------|---------|
| Worker 未更新就送任務 | 使用者看不到摘要 | Feature Flag 阻擋，Phase 6 前不開放 |
| 50 筆 FIFO 刪除競爭條件 | 資料不一致 | 使用 Prisma Transaction（見 §5） |
| YouTube API 限流 | 處理失敗 | 已有錯誤分類，使用者可手動重試 |

---

## 📦 功能模組與優先級

| 模組 | 優先級 | 描述 |
|------|--------|------|
| 統一搜尋欄 UI | P0 | 單一輸入框 + 類型下拉選單 |
| 單集處理 API | P0 | 驗證 URL、建立處理任務 |
| 單集關聯資料表 | P0 | `UserSingleEpisode` 追蹤收藏 |
| Worker 單集處理 | P0 | 新增 `SINGLE_VIDEO` / `SINGLE_EPISODE` 類型 |
| 網站顯示整合 | P0 | 「收藏單集」Tab + ALL 混合顯示 |
| 分享功能整合 | P1 | 複用現有 `/video/` `/episode/` 路由 |

---

## 🔧 設計決策

### 1. UI 設計：統一搜尋欄

取代目前分開的 YouTube / Podcast 表單，改為單一輸入框 + 左側下拉選單：

```
┌─────────────────────────────────────────────────────────────┐
│ [▾ 訂閱 YouTube 頻道 ] │ 貼上連結...                    │ [送出] │
│ ┌──────────────────────┐ │                                │        │
│ │ 訂閱 YouTube 頻道    │ │                                │        │
│ │ 訂閱 Podcast 頻道    │ │                                │        │
│ │ ───────────────────  │ │                                │        │
│ │ 產生單集摘要 ✨      │ │                                │        │
│ └──────────────────────┘ │                                │        │
└─────────────────────────────────────────────────────────────┘
```

**下拉選項**：
1. 訂閱 YouTube 頻道 *(預設)*
2. 訂閱 Podcast 頻道
3. 產生單集摘要 ✨ *(新增)*

**單集模式額外顯示**：
- 風格選擇器：深度筆記 / 快速閱讀
- 語言選擇器：English / 繁體中文

---

### 2. URL 解析與驗證

| 使用者選擇 | 接受的 URL 類型 | 範例 |
|-----------|----------------|------|
| 訂閱 YouTube 頻道 | 頻道 URL | `youtube.com/@channel`、`youtube.com/channel/UC...` |
| 訂閱 Podcast 頻道 | Podcast Feed URL | `podcasts.apple.com/.../podcast/xxx` |
| 產生單集摘要 | 影片/單集 URL | `youtube.com/watch?v=xxx`、`youtu.be/xxx`、`podcasts.apple.com/.../episode/xxx` |

**錯誤處理**：
- 選擇「單集模式」但貼上頻道 URL → 顯示：「請貼上影片或單集連結，非頻道連結」
- 選擇「訂閱頻道」但貼上影片 URL → 顯示：「請貼上頻道連結，或切換至『產生單集摘要』模式」

---

### 3. 登入要求

> ⚠️ **重要**：單集摘要功能 **僅限已登入使用者**

**訪客流程**：
1. 訪客選擇「產生單集摘要」並貼上連結、選擇風格/語言
2. 點擊送出 → **暫存請求到 LocalStorage** → 彈出登入 Modal
3. 登入成功後 → **自動讀取 LocalStorage，接續處理**

**LocalStorage 暫存實作**：

```typescript
// LocalStorage Key
const PENDING_SINGLE_EPISODE = 'pending_single_episode';

// 訪客點擊「產生摘要」時
if (!session) {
  localStorage.setItem(PENDING_SINGLE_EPISODE, JSON.stringify({ url, style, language }));
  openLoginModal();
  return;
}

// 登入成功後（在 Auth Callback 或 useEffect 中）
useEffect(() => {
  if (session) {
    const pending = localStorage.getItem(PENDING_SINGLE_EPISODE);
    if (pending) {
      submitSingleEpisode(JSON.parse(pending));
      localStorage.removeItem(PENDING_SINGLE_EPISODE);
    }
  }
}, [session]);
```

> 💡 此設計與訪客訂閱頻道的 LocalStorage 暫存邏輯一致（參考 [`frontend_subscription.md` §2](file:///Users/tomyangdh/youtube-rss-generator/documents/gwt/frontend_subscription.md#L50-L62)）

---

### 4. 重複處理與風格衝突解決

#### 基本 Deduplication 規則

| 場景 | 行為 |
|------|------|
| 使用者重複貼上同一支影片（相同 style/language） | 若摘要已存在 → 直接顯示；否則不建立重複 `UserSingleEpisode` |
| 多個使用者貼上同一支影片 | 複用 `YoutubeVideo` 和 `VideoSummary`，各自建立 `UserSingleEpisode` 關聯 |

#### 風格/語言衝突解決（訂閱 vs 單集）

**場景**：使用者已訂閱頻道 A（style=DEEP_NOTES, language=EN），但透過單集模式貼上頻道 A 的某支影片，並選擇 style=QUICK_READ, language=ZH_TW。

**決策**：**尊重使用者當下選擇，產生新摘要，且一律建立 UserSingleEpisode**

**處理邏輯**：
```typescript
// POST /api/single-episode
const existingSubscription = await findSubscriptionForVideo(videoId, userId);

// 檢查是否已有使用者指定 style/language 的摘要
const existingSummary = await findSummary(videoId, requestedStyle, requestedLanguage);

// 無論是否已訂閱，都建立 UserSingleEpisode（讓「收藏單集」Tab 可見）
const userSingleEpisode = await createUserSingleEpisode({
  userId,
  videoId,
  style: requestedStyle,
  language: requestedLanguage,
  status: existingSummary ? 'COMPLETED' : 'PENDING'
});

if (existingSummary) {
  // 摘要已存在，直接回傳
  return {
    status: 'ready',
    id: userSingleEpisode.id,
    summary: existingSummary,
    linkedToSubscription: !!existingSubscription
  };
}

// 需要產生新摘要，加入 Queue
await queueSummaryGeneration(videoId, requestedStyle, requestedLanguage);
return {
  status: 'queued',
  id: userSingleEpisode.id,
  linkedToSubscription: !!existingSubscription
};
```

**設計理由**：
- 使用者明確選擇單集模式，預期在「收藏單集」Tab 看到該影片
- 「訂閱頻道」與「收藏單集」是不同的使用情境：前者是追蹤頻道，後者是個人精選
- 底層 `VideoSummary` 可儲存多版本（以 style + language 為 key）
- 無需彈出確認對話框，減少 UX 摩擦

**Tab 顯示行為**：

| Tab | 顯示該影片？ | 說明 |
|-----|------------|------|
| YouTube 頻道 | ✅ | 因為訂閱了該頻道 |
| 收藏單集 | ✅ | 因為用了單集模式 |
| ALL | ✅（只出現一次） | 單集設定優先於訂閱設定 |

---

### 5. 50 集限制與 FIFO 刪除

**規則**：
- 每位使用者最多保留 50 筆 `UserSingleEpisode`
- 新增第 51 筆時，**自動刪除 `createdAt` 最舊的 1 筆**
- 僅刪除 `UserSingleEpisode` 關聯，**不刪除** `Video` / `Episode` / `Summary` 本身（可能被其他使用者使用）

**Race Condition 處理**：

當使用者快速連續提交多筆請求時，可能發生競爭條件。使用 Transaction 確保原子性：

```typescript
await prisma.$transaction(async (tx) => {
  // 1. 計算目前數量
  const count = await tx.userSingleEpisode.count({
    where: { userId }
  });

  // 2. 若已達上限，刪除最舊的
  if (count >= 50) {
    const oldest = await tx.userSingleEpisode.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' }
    });
    if (oldest) {
      await tx.userSingleEpisode.delete({ where: { id: oldest.id } });
    }
  }

  // 3. 新增新記錄
  return tx.userSingleEpisode.create({ data: { ... } });
});
```

---

### 6. 處理優先級

| Queue Type | Priority | 觸發場景 | 說明 |
|------------|----------|----------|------|
| `SINGLE_VIDEO` | **10** | 使用者貼上單集 | 單集優先處理 |
| `SINGLE_EPISODE` | **10** | 使用者貼上單集 | 單集優先處理 |
| `YOUTUBE` / `PODCAST` | **10** | **使用者新增訂閱** | 新訂閱優先掃描 |
| `YOUTUBE` / `PODCAST` | **0** | **系統例行維護** | 背景檢查新影片 |

---

### 7. 處理失敗與錯誤狀態

#### 狀態機設計

為 `UserSingleEpisode` 新增 `status` 欄位，追蹤處理進度：

```prisma
enum SingleEpisodeStatus {
  PENDING      // 已加入 Queue，等待 Worker 處理
  PROCESSING   // Worker 正在處理中
  COMPLETED    // 摘要產生成功
  FAILED       // 處理失敗
}
```

**狀態流轉**：

```
PENDING ──(Worker 開始)──> PROCESSING ──(成功)──> COMPLETED
                                      └─(失敗)──> FAILED

FAILED ──(使用者點擊重試)──> PENDING
```

> ⚠️ **設計決策**：不自動重試。失敗後立即通知使用者，由使用者決定是否手動重試。

#### 錯誤類型與使用者訊息

| 失敗原因代碼 | 使用者訊息 | 顯示重試按鈕？ |
|-------------|-----------|--------------|
| `NO_TRANSCRIPT` | 「此影片沒有字幕，無法產生摘要」 | ❌ |
| `AGE_RESTRICTED` | 「此影片有年齡限制，無法處理」 | ❌ |
| `REGION_BLOCKED` | 「此影片在我們的伺服器所在地區無法播放」 | ❌ |
| `VIDEO_TOO_LONG` | 「影片長度超過 4 小時，暫不支援」 | ❌ |
| `VIDEO_NOT_FOUND` | 「影片不存在或已設為私人」 | ❌ |
| `API_ERROR` | 「處理時發生錯誤，請稍後再試」 | ✅ |
| `TRANSCRIPTION_ERROR` | 「轉錄服務暫時無法使用，請稍後再試」 | ✅ |
| `SUMMARIZATION_ERROR` | 「摘要服務暫時無法使用，請稍後再試」 | ✅ |

#### 前端處理

```typescript
// 根據 status 顯示不同 UI
switch (singleEpisode.status) {
  case 'PENDING':
    return <StatusCard icon="⏳" message="排隊中..." />;
  case 'PROCESSING':
    return <StatusCard icon="⚙️" message="正在產生摘要...（約 1-2 分鐘）" />;
  case 'COMPLETED':
    return <SummaryContent summary={singleEpisode.summary} />;
  case 'FAILED':
    return (
      <FailedCard
        message={getErrorMessage(singleEpisode.failureReason)}
        showRetry={isRetryableError(singleEpisode.failureReason)}
        onRetry={() => retrySingleEpisode(singleEpisode.id)}
        onDelete={() => deleteSingleEpisode(singleEpisode.id)}
      />
    );
}
```

**失敗 UI 範例**：

```
┌─────────────────────────────────────────────────┐
│ 🔴 無法產生摘要                                    │
│ 「此影片沒有字幕，無法產生摘要」                      │
│                                                   │
│                              [刪除]               │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 🔴 無法產生摘要                                    │
│ 「處理時發生錯誤，請稍後再試」                        │
│                                                   │
│                       [刪除]  [重新嘗試]            │
└─────────────────────────────────────────────────┘
```

#### 前端狀態輪詢

使用 React Query 的 `refetchInterval` 實現自動更新：

```typescript
// hooks/useSingleEpisodes.ts
export function useSingleEpisodes() {
  return useQuery({
    queryKey: ['single-episodes'],
    queryFn: fetchSingleEpisodes,
    // 有任何 PENDING/PROCESSING 狀態時，每 5 秒刷新
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasPending = data?.items.some(
        item => ['PENDING', 'PROCESSING'].includes(item.status)
      );
      return hasPending ? 5000 : false;
    },
  });
}
```

#### Worker 狀態更新

Worker 在處理過程中需更新 `UserSingleEpisode.status`：

```python
# backend/worker/single.py

async def process_single_episode(task_id: int):
    task = await get_task(task_id)
    user_single_episode_id = task.user_single_episode_id

    # 1. 開始處理：PENDING → PROCESSING
    await update_user_single_episode_status(user_single_episode_id, 'PROCESSING')

    try:
        # 2. 執行處理邏輯
        if task.type == 'SINGLE_VIDEO':
            metadata = await fetch_video_metadata(task.video_id)
            transcript = await download_and_transcribe_audio(metadata)
            summary = await generate_summary(transcript, task.style, task.language)
            await save_summary(task.video_id, summary, task.style, task.language)
        else:
            # SINGLE_EPISODE (podcast) - 複用現有 podcast 處理流程
            ...

        # 3. 成功：PROCESSING → COMPLETED
        await update_user_single_episode_status(user_single_episode_id, 'COMPLETED')

    except PermanentError as e:
        # 4. 永久性失敗：PROCESSING → FAILED
        await update_user_single_episode_status(
            user_single_episode_id,
            'FAILED',
            failure_reason=e.code  # e.g., 'NO_TRANSCRIPT', 'VIDEO_NOT_FOUND'
        )
    except TransientError as e:
        # 5. 暫時性失敗：也直接標記 FAILED，讓使用者決定是否重試
        await update_user_single_episode_status(
            user_single_episode_id,
            'FAILED',
            failure_reason=e.code  # e.g., 'API_ERROR', 'TRANSCRIPTION_ERROR'
        )
```

---

### 8. URL 額外格式支援

#### YouTube 單集

| 格式 | 範例 | 處理方式 |
|------|------|----------|
| 標準影片 | `youtube.com/watch?v=xxx` | 提取 video ID，正常處理 |
| 短網址 | `youtu.be/xxx` | 提取 video ID，正常處理 |
| 含播放清單參數 | `youtube.com/watch?v=xxx&list=yyy` | 忽略 `list` 參數，僅處理單一影片 |
| YouTube Music | `music.youtube.com/watch?v=xxx` | 提取 video ID，正常處理 |
| **YouTube Shorts** | `youtube.com/shorts/xxx` | ❌ **拒絕處理**，提示「不支援 Shorts」 |

#### Podcast 單集

| 格式 | 範例 | 處理方式 |
|------|------|----------|
| Apple Podcasts 單集 | `podcasts.apple.com/.../episode/xxx` | 解析 episode ID，正常處理 |

> 💡 **注意**：目前僅支援 Apple Podcasts，與訂閱功能一致。Spotify 等其他平台暫不支援。

**錯誤處理**：

| 情況 | 使用者訊息 |
|------|-----------||
| YouTube Shorts | 「不支援 Shorts 影片，請貼上一般影片連結」 |
| 私人影片 | 「此影片為私人影片，無法處理」 |
| 已刪除影片 | 「此影片不存在或已被刪除」 |
| 地區限制 | 「此影片在我們的伺服器所在地區無法播放」 |

---

### 9. Placeholder Channel 設計

**問題**：`YoutubeVideo.channel_id` 為必填欄位，但單集影片的頻道可能從未被訂閱過。

**解決方案**：**自動建立 Placeholder Channel**

當使用者貼上單一影片時：
1. 從影片 metadata 取得 `channel_id`
2. 若頻道不存在 → 建立最小記錄 (`youtube_id`, `title`)
3. 將影片關聯到該頻道

**不需清理**：
- Placeholder channel 與「曾被訂閱後退訂的頻道」狀態相同
- 現有 video retention policy 會持續運作
- 未來若使用者訂閱該頻道，記錄已存在

---

### 10. 單集摘要顯示設計

> ⚠️ **重要設計決策 (2026-01-18)**：單集摘要 **不納入** RSS Feed，僅在網站上顯示。

**不納入 RSS 的理由**：
- 保持 RSS Feed 純淨（只有訂閱頻道的內容）
- 單集功能定位為「試用 / 探索」，不是「長期追蹤」
- 降低實作複雜度（Feed 生成邏輯不需修改）
- 避免 RSS 閱讀器使用者困惑（「這集哪來的？」）

#### 網站顯示位置

**Tab 結構**：
```
[ALL] [YouTube 頻道] [Podcasts] [收藏單集 ✨]
```

- **收藏單集 Tab**：獨立顯示所有使用者收藏的單集
- **ALL Tab**：單集摘要也會混入顯示

#### ALL Tab 混合排序邏輯

| 內容類型 | 排序依據 | 說明 |
|---------|---------|------|
| 訂閱頻道的影片 | `publishedAt` | 影片的原始發佈時間 |
| 單集摘要 | `createdAt` | 使用者貼上連結的時間 |

**行為範例**：
1. 今天 13:00 你貼了一個 2022 年的老影片 → 排序 key = `2026-01-18 13:00`
2. 明天你訂閱的頻道發新影片 → 新影片排到最上面，昨天的單集自然往下掉
3. 不需要特別的「置頂」邏輯，統一按時間排序

**實作概念**：
```typescript
// 混合排序
const sortedItems = [...subscriptionItems, ...singleEpisodes].sort((a, b) => {
  const timeA = a.isSingle ? a.createdAt : a.publishedAt;
  const timeB = b.isSingle ? b.createdAt : b.publishedAt;
  return timeB - timeA; // DESC
});
```

#### 同一影片多版本摘要處理

**場景**：使用者訂閱頻道 A（EN/DEEP_NOTES），後來又透過單集模式對同頻道某影片產生 ZH_TW/QUICK_READ 摘要。此時同一支影片有兩份摘要。

**前端 Feed 顯示規則**：

| 規則 | 說明 |
|------|------|
| **不重複顯示** | 同一 `videoId` 只出現一次 |
| **優先級：單集 > 訂閱** | 若有 `UserSingleEpisode` 記錄，使用該設定的摘要 |
| **理由** | 單集是使用者「主動選擇」的設定，優先權應高於訂閱預設 |

**實作邏輯**（網站 ALL Tab 顯示）：

```typescript
// hooks/useFeedItems.ts 或 components/feed/FeedList.tsx
async function buildWebsiteFeedItems(userId: string) {
  // 1. 取得使用者的單集記錄（videoId → style/language 對應）
  const singleEpisodes = await prisma.userSingleEpisode.findMany({
    where: { userId, status: 'COMPLETED' },
    select: { videoId: true, style: true, language: true, createdAt: true }
  });
  const singleEpisodeMap = new Map(
    singleEpisodes.map(se => [se.videoId, { style: se.style, language: se.language }])
  );

  // 2. 取得訂閱頻道的影片
  const subscribedVideos = await getSubscribedVideos(userId);

  // 3. 合併時決定每支影片要用哪個摘要版本
  const feedItems = subscribedVideos.map(video => {
    const singleEpisodeSetting = singleEpisodeMap.get(video.id);

    if (singleEpisodeSetting) {
      // 使用者有單集設定，優先使用該版本摘要
      return buildFeedItem(video, singleEpisodeSetting.style, singleEpisodeSetting.language);
    }

    // 使用訂閱的預設設定
    return buildFeedItem(video, video.subscription.style, video.subscription.language);
  });

  // 4. 加入非訂閱頻道的單集（不在 subscribedVideos 中的 UserSingleEpisode）
  const nonSubscribedSingleEpisodes = singleEpisodes.filter(
    se => !subscribedVideos.some(v => v.id === se.videoId)
  );

  feedItems.push(...nonSubscribedSingleEpisodes.map(se => buildFeedItemFromSingleEpisode(se)));

  return feedItems.sort((a, b) => b.sortTime - a.sortTime);
}
```

> ⚠️ **注意**：此邏輯僅用於網站 ALL Tab 顯示。RSS Feed（`app/[locale]/feed/user/[token]/route.ts`）**不需修改**，維持只輸出訂閱頻道的內容。

**UI 識別標記**：

對於「同時有訂閱又有單集設定」的影片，可在 UI 顯示小標籤：
```
[單集設定: 繁中/快速閱讀]
```
讓使用者知道這支影片使用的是他特別指定的設定，而非訂閱預設。

---

### 11. 分享功能整合

**完全複用現有架構**：
- YouTube 單集：`/video/[youtubeVideoId]` *(現有路由)*
- Podcast 單集：`/episode/[episodeId]` *(現有路由)*

**無需額外開發**：ShareButton、OG meta、CTA Banner 皆可直接運作。

---

## 📊 資料模型變更

### 新增：`SingleEpisodeStatus` Enum

```prisma
enum SingleEpisodeStatus {
  PENDING      // 已加入 Queue，等待 Worker 處理
  PROCESSING   // Worker 正在處理中
  COMPLETED    // 摘要產生成功
  FAILED       // 永久性失敗，無法產生摘要
}
```

### 新增：`UserSingleEpisode`

```prisma
model UserSingleEpisode {
  id        Int             @id @default(autoincrement())
  userId    String          @map("user_id")
  user      User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Polymorphic: 只會有其中一個有值（透過 DB check constraint 確保）
  videoId   Int?            @map("video_id")
  video     YoutubeVideo?   @relation(fields: [videoId], references: [id], onDelete: Cascade)
  episodeId Int?            @map("episode_id")
  episode   PodcastEpisode? @relation(fields: [episodeId], references: [id], onDelete: Cascade)

  // 使用者選擇的處理設定
  style     SummaryStyle
  language  SummaryLanguage

  // 處理狀態追蹤
  status        SingleEpisodeStatus @default(PENDING)
  failureReason String?             @map("failure_reason")  // 失敗原因代碼

  createdAt DateTime        @default(now()) @map("created_at")

  @@unique([userId, videoId])
  @@unique([userId, episodeId])
  @@index([userId, createdAt])
  @@map("user_single_episodes")
}
```

### 資料庫 Check Constraint（Migration SQL）

> ⚠️ Prisma 不原生支援 check constraint，需透過 raw SQL migration 新增。

```sql
-- prisma/migrations/xxx_add_single_episode_check/migration.sql
ALTER TABLE user_single_episodes
ADD CONSTRAINT check_exactly_one_content
CHECK (
  (video_id IS NOT NULL AND episode_id IS NULL) OR
  (video_id IS NULL AND episode_id IS NOT NULL)
);
```

**目的**：確保每筆 `UserSingleEpisode` 必須且只能關聯一種內容類型（YouTube 影片或 Podcast 單集），防止以下無效資料：
- `videoId` 和 `episodeId` 同時為 `null`（沒有關聯任何內容）
- `videoId` 和 `episodeId` 同時有值（不可能同時是兩種類型）

### 擴充：`QueueType` Enum

```prisma
enum QueueType {
  YOUTUBE         // 現有
  PODCAST         // 現有
  SINGLE_VIDEO    // 新增
  SINGLE_EPISODE  // 新增
}
```

### 擴充：`ProcessingQueue` 欄位

```prisma
model ProcessingQueue {
  // ... 現有欄位
  
  // 新增：追蹤請求者與設定
  requestedByUserId String?         @map("requested_by_user_id")
  requestedStyle    SummaryStyle?   @map("requested_style")
  requestedLanguage SummaryLanguage? @map("requested_language")
}
```

---

## 🔌 API 規劃

### `POST /api/single-episode`

提交單集處理請求

**Request**:
```typescript
{
  url: string;           // YouTube 影片 or Podcast 單集 URL
  style: SummaryStyle;   // 'DEFAULT' | 'QUICK_READ'
  language: SummaryLanguage; // 'EN' | 'ZH_TW'
}
```

**Response**:
```typescript
// 成功
{
  status: 'queued' | 'ready';
  episodeType: 'video' | 'podcast';
  id: number;                      // UserSingleEpisode.id
  externalId: string;              // youtube_video_id 或 podcast episode GUID
  linkedToSubscription?: boolean;  // 若為已訂閱頻道的影片
  summary?: string;                // 若 status=ready，直接回傳摘要
}

// 錯誤
{
  error:
    | 'INVALID_URL'           // URL 格式錯誤或不支援
    | 'PRIVATE_VIDEO'         // 私人影片
    | 'VIDEO_NOT_FOUND'       // 影片不存在或已刪除
    | 'REGION_BLOCKED'        // 地區限制
    | 'VIDEO_TOO_LONG'        // 超過 4 小時
    | 'LIMIT_REACHED';        // 已達 50 筆上限
  message: string;
}
```

> **注意**：移除 `ALREADY_SUBSCRIBED` 錯誤。已訂閱頻道的影片仍可處理（產生不同 style/language 的摘要），改以 `linkedToSubscription: true` 標記。

### `GET /api/single-episodes`

取得當前使用者的單集收藏列表

**Response**:
```typescript
{
  items: Array<{
    id: number;
    type: 'video' | 'podcast';
    externalId: string;              // youtube_video_id 或 podcast episode GUID
    title: string;
    thumbnailUrl?: string;
    style: SummaryStyle;
    language: SummaryLanguage;
    status: SingleEpisodeStatus;     // 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
    failureReason?: string;          // 若 status=FAILED，失敗原因代碼
    createdAt: string;
  }>;
  total: number;
  limit: 50;
}
```

### `DELETE /api/single-episodes/[id]`

刪除指定單集收藏 (僅刪除關聯，不刪除內容)

### `POST /api/single-episodes/[id]/retry`

重新嘗試處理失敗的單集

**前置條件**：
- 該 `UserSingleEpisode` 的 `status` 必須為 `FAILED`
- 該記錄必須屬於當前登入使用者

**行為**：
1. 重設 `status` 為 `PENDING`
2. 清空 `failureReason`
3. 重新加入 ProcessingQueue

**Response**:
```typescript
// 成功
{ status: 'queued', id: number }

// 錯誤
{ error: 'NOT_FOUND' | 'NOT_FAILED' | 'FORBIDDEN', message: string }
```

---

## ✅ 驗收標準

### P0：核心功能

| # | 測試案例 | 預期結果 |
|---|---------|---------|
| 1 | 已登入用戶貼上 YouTube 影片連結 | 加入 Queue、顯示 Processing 狀態 |
| 2 | 已登入用戶貼上 Podcast 單集連結 | 加入 Queue、顯示 Processing 狀態 |
| 3 | Worker 處理完成 | 摘要可見、使用指定 style/language |
| 4 | 訪客貼上連結並送出 | 彈出登入 Modal |
| 5 | 使用者貼上已訂閱頻道的影片（相同 style/language） | 直接顯示現有摘要，`linkedToSubscription: true` |
| 6 | 使用者貼上已訂閱頻道的影片（不同 style/language） | 產生新摘要，`linkedToSubscription: true` |
| 7 | 使用者有 50 筆單集，新增第 51 筆 | 最舊 1 筆被刪除，新增成功 |
| 8 | 選擇「單集模式」但貼上頻道 URL | 顯示錯誤提示 |

### P0：錯誤處理

| # | 測試案例 | 預期結果 |
|---|---------|---------|
| 9 | 貼上私人影片連結 | 顯示「此影片為私人影片，無法處理」 |
| 10 | 貼上已刪除影片連結 | 顯示「此影片不存在或已被刪除」 |
| 11 | 貼上超過 4 小時的影片 | 顯示「影片長度超過 4 小時，暫不支援」 |
| 12 | Worker 處理失敗（無字幕） | 狀態更新為 FAILED，顯示錯誤訊息 |
| 13 | Worker 處理失敗（暫時性錯誤） | 立即標記 FAILED，顯示「重新嘗試」按鈕 |

### P1：整合功能

| # | 測試案例 | 預期結果 |
|---|---------|---------|
| 14 | RSS Feed 訂閱 | 單集摘要 **不出現** 在 RSS Feed 中（僅網站顯示） |
| 15 | 點擊分享按鈕 | 正確複製公開 URL |
| 16 | 訪問公開頁面 | OG meta 正確、CTA 可見 |
| 17 | 同一影片有訂閱摘要 + 單集摘要 | 網站 ALL Tab 中只顯示一次，使用單集設定 |
| 18 | 貼上 YouTube Shorts 連結 | 顯示「不支援 Shorts 影片」錯誤訊息 |
| 19 | 貼上含 playlist 參數的連結 | 忽略 playlist，僅處理單一影片 |
| 20 | 使用者點擊失敗項目的「重新嘗試」按鈕 | 狀態重設為 PENDING，重新加入 Queue |
| 21 | 使用者點擊失敗項目的「刪除」按鈕 | 該單集從收藏列表移除 |
| 22 | 使用者貼上已訂閱頻道的影片 | 建立 UserSingleEpisode，在「收藏單集」Tab 可見 |

---

## 🧪 測試計畫

### 單元測試

#### 前端（TypeScript/Jest）

| 測試檔案 | 測試對象 | 測試案例 |
|---------|---------|---------|
| `lib/services/__tests__/urlParser.test.ts` | `parseVideoUrl()` | - 標準 YouTube URL 解析正確 |
| | | - 短網址 `youtu.be/xxx` 解析正確 |
| | | - 含 playlist 參數時忽略 `list`，僅提取 video ID |
| | | - YouTube Music URL 解析正確 |
| | | - YouTube Shorts URL 回傳 `{ error: 'SHORTS_NOT_SUPPORTED' }` |
| | | - Apple Podcasts episode URL 解析正確 |
| | | - 無效 URL 回傳 `{ error: 'INVALID_URL' }` |
| | `detectUrlType()` | - 區分頻道 URL vs 單集 URL |
| `lib/services/__tests__/singleEpisode.test.ts` | `createSingleEpisode()` | - 正常建立 UserSingleEpisode |
| | | - 達到 50 筆上限時自動刪除最舊 |
| | | - 重複提交相同 videoId + style + language 時回傳現有記錄 |
| | `isRetryableError()` | - `API_ERROR` 回傳 `true` |
| | | - `NO_TRANSCRIPT` 回傳 `false` |
| `hooks/__tests__/useSingleEpisodes.test.ts` | `useSingleEpisodes` | - 有 PENDING 狀態時啟用 polling |
| | | - 全部 COMPLETED 時停止 polling |

#### 後端（Python/pytest）

| 測試檔案 | 測試對象 | 測試案例 |
|---------|---------|---------|
| `backend/worker/tests/test_single.py` | `process_single_video()` | - 成功處理時更新狀態為 COMPLETED |
| | | - 無字幕時更新狀態為 FAILED + `NO_TRANSCRIPT` |
| | | - API 錯誤時更新狀態為 FAILED + `API_ERROR` |
| | `classify_error()` | - YouTube API 404 → `VIDEO_NOT_FOUND` |
| | | - YouTube API 403 (age) → `AGE_RESTRICTED` |
| | | - 轉錄服務 500 → `TRANSCRIPTION_ERROR` |
| `backend/services/tests/test_youtube_metadata.py` | `fetch_video_metadata()` | - 正確解析影片標題、頻道 ID、時長 |
| | | - 超過 4 小時回傳錯誤 |

### 整合測試

| 測試檔案 | 測試範圍 | 測試案例 |
|---------|---------|---------|
| `app/api/single-episode/__tests__/route.test.ts` | POST API | - 未登入回傳 401 |
| | | - 有效 URL 建立 UserSingleEpisode + 加入 Queue |
| | | - 無效 URL 回傳 400 + 錯誤訊息 |
| | | - Shorts URL 回傳 400 + `SHORTS_NOT_SUPPORTED` |
| `app/api/single-episodes/__tests__/route.test.ts` | GET API | - 回傳當前使用者的單集列表 |
| | | - 不回傳其他使用者的資料 |
| `app/api/single-episodes/[id]/__tests__/route.test.ts` | DELETE API | - 成功刪除自己的記錄 |
| | | - 無法刪除他人的記錄（403） |
| `app/api/single-episodes/[id]/retry/__tests__/route.test.ts` | POST retry | - 狀態為 FAILED 時可重試 |
| | | - 狀態為 COMPLETED 時回傳 400 |
| | | - 重試後狀態變為 PENDING |

### Mock 策略

| 外部依賴 | Mock 方式 |
|---------|----------|
| YouTube Data API | 使用 `msw` 或 fixture 檔案模擬 API 回應 |
| Prisma Database | 使用 `@prisma/client` 的 mock 或 SQLite in-memory |
| 轉錄服務 | Mock `download_and_transcribe_audio()` 回傳固定 transcript |
| LLM 摘要服務 | Mock `generate_summary()` 回傳固定摘要 |

### 測試檔案結構

```
├── lib/services/__tests__/
│   ├── urlParser.test.ts
│   └── singleEpisode.test.ts
├── hooks/__tests__/
│   └── useSingleEpisodes.test.ts
├── app/api/single-episode/__tests__/
│   └── route.test.ts
├── app/api/single-episodes/__tests__/
│   └── route.test.ts
├── app/api/single-episodes/[id]/__tests__/
│   └── route.test.ts
├── app/api/single-episodes/[id]/retry/__tests__/
│   └── route.test.ts
└── backend/worker/tests/
    └── test_single.py
```

### 測試執行指令

```bash
# 前端單元測試
npm run test -- --testPathPattern="single"

# 前端整合測試
npm run test:integration -- --testPathPattern="single"

# 後端測試
cd backend && pytest worker/tests/test_single.py -v
```

---

## 📁 影響檔案清單

| 類別 | 檔案 | 變更類型 |
|------|------|----------|
| **Schema** | `prisma/schema.prisma` | 新增 Model + Enum |
| **Migration** | `prisma/migrations/xxx_add_single_episode_check/migration.sql` | 新增：DB check constraint |
| **API** | `app/api/single-episode/route.ts` | 新增 |
| **API** | `app/api/single-episodes/route.ts` | 新增 |
| **API** | `app/api/single-episodes/[id]/route.ts` | 新增：DELETE |
| **API** | `app/api/single-episodes/[id]/retry/route.ts` | 新增：POST 重試 |
| **Services** | `lib/services/singleEpisode.ts` | 新增：單集業務邏輯（含 polymorphic 驗證） |
| **Services** | `lib/services/urlParser.ts` | 新增/修改：URL 解析（Shorts, Music, playlist 參數） |
| **Worker** | `backend/worker/daemon.py` | 修改：支援新 QueueType |
| **Worker** | `backend/worker/single.py` | 新增：單集處理邏輯 |
| **Services** | `backend/services/youtube_metadata.py` | 依賴：RSS/Scrapetube 取得影片 metadata |
| **Worker** | `backend/worker/transcribe.py` | 依賴：`download_and_transcribe_audio` 函數 |
| **UI** | `components/subscription/ChannelManager/AddChannelForm.tsx` | 重構：統一搜尋欄 |
| **UI** | `components/subscription/ModeSelector.tsx` | 新增：下拉選單元件 |
| **UI** | `components/subscription/SingleEpisodeStatus.tsx` | 新增：狀態顯示元件（PENDING/PROCESSING/COMPLETED/FAILED） |
| **Hook** | `hooks/useSingleEpisodes.ts` | 新增：單集列表 + 狀態輪詢 |
| **Hook** | `hooks/useFeedItems.ts` | 修改：網站 ALL Tab 混合顯示邏輯 |
| **i18n** | `messages/en.json`, `messages/zh-TW.json` | 新增翻譯鍵值 |
| **Types** | `lib/types.ts` | 擴充 FeedItem 類型、SingleEpisodeStatus |
| **Test** | `lib/services/__tests__/urlParser.test.ts` | 新增：URL 解析單元測試 |
| **Test** | `lib/services/__tests__/singleEpisode.test.ts` | 新增：單集服務單元測試 |
| **Test** | `hooks/__tests__/useSingleEpisodes.test.ts` | 新增：Hook 單元測試 |
| **Test** | `app/api/single-episode/__tests__/route.test.ts` | 新增：POST API 整合測試 |
| **Test** | `app/api/single-episodes/__tests__/route.test.ts` | 新增：GET API 整合測試 |
| **Test** | `app/api/single-episodes/[id]/__tests__/route.test.ts` | 新增：DELETE API 整合測試 |
| **Test** | `app/api/single-episodes/[id]/retry/__tests__/route.test.ts` | 新增：重試 API 整合測試 |
| **Test** | `backend/worker/tests/test_single.py` | 新增：Worker 單元測試 |

> **架構備註 (2026-01-18):**
> - YouTube metadata 取得邏輯已重構至 `backend/services/youtube_metadata.py`
> - 音訊下載+轉錄邏輯位於 `backend/worker/transcribe.py` (`download_and_transcribe_audio`)
> - `single.py` 應從 services layer import metadata functions，從 transcribe.py import 轉錄函數

---

## 🔢 工程估點參考

| 模組 | 預估複雜度 | 備註 |
|------|-----------|------|
| Schema Migration | S | 新增 Model + 欄位 |
| API: single-episode | M | URL 解析、Dedup 邏輯 |
| API: single-episodes CRUD | S | 標準 CRUD |
| Worker 單集處理 | M | 新流程，複用 `services/youtube_metadata` + `transcribe.py` + `summarize.py` |
| UI 統一搜尋欄 | M | 重構現有表單 |
| 網站 Feed 整合 | S | ALL Tab 混合顯示邏輯 |
| i18n | S | 約 10-15 鍵值 |
| 單元測試 | M | URL 解析、Service 層、Hook |
| 整合測試 | M | API routes、Worker 處理流程 |
| **總計** | **L** | 建議 3-4 個 Sprint |

---

## 📋 Open Questions (已解決)

| 問題 | 決策 |
|------|------|
| 訪客是否可看摘要？ | ❌ 需登入後才能看。處理邏輯同訪客訂閱新頻道的流程（參考 [`documents/gwt/frontend_subscription.md` §2 Guest Mode Handling](file:///Users/tomyangdh/youtube-rss-generator/documents/gwt/frontend_subscription.md#L50-L62)：訪客操作 → 跳出 Login Modal → 登入成功後繼續原動作） |
| 單集 vs 訂閱優先級？ | 單集 priority=10，訂閱 priority=0 |
| Placeholder channel 清理？ | 不需要，與退訂頻道相同處理 |
| 已訂閱頻道影片選擇不同 style/language？ | ✅ 尊重使用者選擇，產生新版本摘要（見 §4 風格衝突解決） |
| 已訂閱頻道影片是否建立 UserSingleEpisode？ | ✅ 一律建立。讓「收藏單集」Tab 可見，符合使用者預期（見 §4） |
| 同一影片多版本摘要如何顯示？ | 網站 ALL Tab 中只顯示一次，單集設定優先於訂閱設定（見 §10） |
| 單集摘要是否納入 RSS Feed？ | ❌ 不納入。RSS Feed 保持純淨，僅包含訂閱頻道內容（見 §10） |
| videoId/episodeId 如何確保互斥？ | DB check constraint + 應用層驗證（見 §資料模型變更） |
| 處理失敗如何處理？ | 不自動重試。立即標記 FAILED，讓使用者手動重試或刪除（見 §7） |
| YouTube Shorts 是否支援？ | ❌ 不支援。顯示「不支援 Shorts 影片」錯誤訊息（見 §8） |

---

## 🚀 實作與部署策略

> **背景 (2026-01-18)**：Mac Mini 上正在運行舊版 Worker，無法立即更新。需採用兩階段部署策略，確保服務不中斷。

### ⚠️ 重要警告：Worker 相容性問題

現有 `daemon.py` 的任務派發邏輯：

```python
if entity_type == 'YOUTUBE':
    process_youtube_channel(...)
elif entity_type == 'PODCAST':
    process_podcast_channel(...)
# ❌ 沒有 else 處理未知類型！
```

**風險**：若在 Worker 更新前送出 `SINGLE_VIDEO` 類型任務：
- 舊 Worker 會抓取該任務
- 發現類型不認識，但不會報錯
- 直接標記為 `COMPLETED`（假成功）
- **使用者永遠看不到摘要**

### 📋 兩階段部署計畫

#### Phase 1：開發實作（可立即執行）

| 項目 | 可否執行 | 說明 |
|------|----------|------|
| Schema Migration | ✅ 可以 | 新增 `UserSingleEpisode` 表、擴充 `QueueType` Enum |
| 前端 UI 開發 | ✅ 可以 | 統一搜尋欄、下拉選單、表單驗證 |
| API Route 實作 | ✅ 可以 | 寫好邏輯，但需加 Feature Flag 阻擋 |
| Worker 新增 `single.py` | ✅ 可以 | 本地開發與測試 |
| **送出任務到 Queue** | ❌ 禁止 | 舊 Worker 會誤處理 |

**建議**：在 API 加入 Feature Flag 防止誤觸發：

```typescript
// app/api/single-episode/route.ts
export async function POST(request: Request) {
  if (process.env.ENABLE_SINGLE_EPISODE !== 'true') {
    return NextResponse.json(
      { error: 'FEATURE_DISABLED', message: '功能尚未開放' },
      { status: 503 }
    );
  }
  // ... 正式邏輯
}
```

#### Phase 2：正式部署（需接觸 Mac Mini）

執行順序：

1. **停止 Mac Mini Worker**
   ```bash
   # SSH 到 Mac Mini
   pkill -f "python.*daemon"
   ```

2. **更新程式碼**
   ```bash
   git pull origin main
   ```

3. **執行 DB Migration**（若 Phase 1 未執行）
   ```bash
   npx prisma db push
   ```

4. **重啟 Worker**
   ```bash
   python3 -m backend.worker.daemon
   ```

5. **開啟 Feature Flag**
   - 在 Vercel Dashboard 設定 `ENABLE_SINGLE_EPISODE=true`
   - 或更新 `.env.production`

6. **部署前端**
   - Push 到 main 分支觸發 Vercel 部署

### ✅ 部署驗證清單

- [ ] Mac Mini Worker 已更新並認識 `SINGLE_VIDEO` / `SINGLE_EPISODE` 類型
- [ ] Feature Flag 已開啟
- [ ] 測試：貼上 YouTube 影片連結，確認任務成功建立
- [ ] 測試：確認 Worker logs 顯示正在處理 `SINGLE_VIDEO` 類型
- [ ] 測試：確認摘要成功產生並顯示在前端
