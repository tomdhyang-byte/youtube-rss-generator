# 單集摘要功能 PRD

> **目標**：讓已登入使用者可以貼上「單集」YouTube 影片或 Podcast 單集連結，立即產生 AI 摘要，無需訂閱整個頻道。

> 要思考一下如果已經有訂閱的頻道，使用者再貼上影片連結，是否會產生重複處理的問題？（比方說選擇了不同的語言或者風格，該如何處理）

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

## 📦 功能模組與優先級

| 模組 | 優先級 | 描述 |
|------|--------|------|
| 統一搜尋欄 UI | P0 | 單一輸入框 + 類型下拉選單 |
| 單集處理 API | P0 | 驗證 URL、建立處理任務 |
| 單集關聯資料表 | P0 | `UserSingleEpisode` 追蹤收藏 |
| Worker 單集處理 | P0 | 新增 `SINGLE_VIDEO` / `SINGLE_EPISODE` 類型 |
| RSS Feed 整合 | P1 | 單集摘要納入個人化 Feed |
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
1. 訪客選擇「產生單集摘要」並貼上連結
2. 點擊送出 → 彈出登入 Modal
3. 登入成功後 → 自動繼續處理剛才的連結

---

### 4. 重複處理 (Deduplication)

| 場景 | 行為 |
|------|------|
| 使用者已訂閱頻道 A，貼上頻道 A 的某支影片 | **Link 回 existing subscription**，使用訂閱的 style/language 設定 |
| 使用者重複貼上同一支影片 | 若摘要已存在 → 直接顯示；否則不建立重複 `UserSingleEpisode` |
| 多個使用者貼上同一支影片 | 複用 `YoutubeVideo` 和 `VideoSummary`，各自建立 `UserSingleEpisode` 關聯 |

---

### 5. 50 集限制與 FIFO 刪除

**規則**：
- 每位使用者最多保留 50 筆 `UserSingleEpisode`
- 新增第 51 筆時，**自動刪除 `createdAt` 最舊的 1 筆**
- 僅刪除 `UserSingleEpisode` 關聯，**不刪除** `Video` / `Episode` / `Summary` 本身（可能被其他使用者使用）

---

### 6. 處理優先級

| Queue Type | Priority | 說明 |
|------------|----------|------|
| `SINGLE_VIDEO` | **10** | 單集 YouTube，優先處理 |
| `SINGLE_EPISODE` | **10** | 單集 Podcast，優先處理 |
| `YOUTUBE` | 0 | 訂閱頻道背景處理 |
| `PODCAST` | 0 | 訂閱 Podcast 背景處理 |

---

### 7. Placeholder Channel 設計

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

### 8. RSS Feed 整合

**決策**：✅ 單集摘要**納入**個人化 Feed

| 項目 | 說明 |
|------|------|
| 排序 | 與訂閱內容依 `published_at` 混合排序 |
| 識別 | RSS item 可加 `<category>single-episode</category>` 標記 |
| 風格 | 使用使用者貼上時選擇的 `style` / `language` |

---

### 9. 分享功能整合

**完全複用現有架構**：
- YouTube 單集：`/video/[youtubeVideoId]` *(現有路由)*
- Podcast 單集：`/episode/[episodeId]` *(現有路由)*

**無需額外開發**：ShareButton、OG meta、CTA Banner 皆可直接運作。

---

## 📊 資料模型變更

### 新增：`UserSingleEpisode`

```prisma
model UserSingleEpisode {
  id        Int             @id @default(autoincrement())
  userId    String          @map("user_id")
  user      User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Polymorphic: 只會有其中一個有值
  videoId   Int?            @map("video_id")
  video     YoutubeVideo?   @relation(fields: [videoId], references: [id], onDelete: Cascade)
  episodeId Int?            @map("episode_id")
  episode   PodcastEpisode? @relation(fields: [episodeId], references: [id], onDelete: Cascade)
  
  // 使用者選擇的處理設定
  style     SummaryStyle
  language  SummaryLanguage
  
  createdAt DateTime        @default(now()) @map("created_at")
  
  @@unique([userId, videoId])
  @@unique([userId, episodeId])
  @@index([userId, createdAt])
  @@map("user_single_episodes")
}
```

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
  id: number;            // UserSingleEpisode.id
  externalId: string;    // youtube_video_id 或 episode.id
  summary?: string;      // 若 status=ready，直接回傳摘要
}

// 錯誤
{
  error: 'INVALID_URL' | 'ALREADY_SUBSCRIBED' | 'LIMIT_REACHED';
  message: string;
}
```

### `GET /api/single-episodes`

取得當前使用者的單集收藏列表

**Response**:
```typescript
{
  items: Array<{
    id: number;
    type: 'video' | 'podcast';
    externalId: string;
    title: string;
    thumbnailUrl?: string;
    style: SummaryStyle;
    language: SummaryLanguage;
    createdAt: string;
    hasSummary: boolean;
  }>;
  total: number;
  limit: 50;
}
```

### `DELETE /api/single-episodes/[id]`

刪除指定單集收藏 (僅刪除關聯，不刪除內容)

---

## ✅ 驗收標準

### P0：核心功能

| # | 測試案例 | 預期結果 |
|---|---------|---------|
| 1 | 已登入用戶貼上 YouTube 影片連結 | 加入 Queue、顯示 Processing 狀態 |
| 2 | 已登入用戶貼上 Podcast 單集連結 | 加入 Queue、顯示 Processing 狀態 |
| 3 | Worker 處理完成 | 摘要可見、使用指定 style/language |
| 4 | 訪客貼上連結並送出 | 彈出登入 Modal |
| 5 | 使用者貼上已訂閱頻道的影片 | 正確 link 回訂閱，不重複建立 |
| 6 | 使用者有 50 筆單集，新增第 51 筆 | 最舊 1 筆被刪除，新增成功 |
| 7 | 選擇「單集模式」但貼上頻道 URL | 顯示錯誤提示 |

### P1：整合功能

| # | 測試案例 | 預期結果 |
|---|---------|---------|
| 8 | RSS Feed 訂閱 | 單集摘要出現在 Feed 中 |
| 9 | 點擊分享按鈕 | 正確複製公開 URL |
| 10 | 訪問公開頁面 | OG meta 正確、CTA 可見 |

---

## 📁 影響檔案清單

| 類別 | 檔案 | 變更類型 |
|------|------|----------|
| **Schema** | `prisma/schema.prisma` | 新增 Model + Enum |
| **API** | `app/api/single-episode/route.ts` | 新增 |
| **API** | `app/api/single-episodes/route.ts` | 新增 |
| **API** | `app/api/single-episodes/[id]/route.ts` | 新增 |
| **Worker** | `backend/worker/daemon.py` | 修改：支援新 QueueType |
| **Worker** | `backend/worker/single.py` | 新增：單集處理邏輯 |
| **Services** | `backend/services/youtube_metadata.py` | 依賴：RSS/Scrapetube 取得影片 metadata |
| **Worker** | `backend/worker/transcribe.py` | 依賴：`download_and_transcribe_audio` 函數 |
| **UI** | `components/subscription/ChannelManager/AddChannelForm.tsx` | 重構：統一搜尋欄 |
| **UI** | `components/subscription/ModeSelector.tsx` | 新增：下拉選單元件 |
| **Hook** | `hooks/useSingleEpisodes.ts` | 新增 |
| **Feed** | `app/[locale]/feed/user/[token]/route.ts` | 修改：納入單集 |
| **i18n** | `messages/en.json`, `messages/zh-TW.json` | 新增翻譯鍵值 |
| **Types** | `lib/types.ts` | 擴充 FeedItem 類型 |

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
| RSS Feed 整合 | S | Query 調整 |
| i18n | S | 約 10-15 鍵值 |
| **總計** | **M+** | 建議 2-3 個 Sprint |

---

## 📋 Open Questions (已解決)

| 問題 | 決策 |
|------|------|
| 訪客是否可看摘要？ | ❌ 需登入後才能看 |
| 單集 vs 訂閱優先級？ | 單集 priority=10，訂閱 priority=0 |
| Placeholder channel 清理？ | 不需要，與退訂頻道相同處理 |
