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

**決策**：**尊重使用者當下選擇，產生新摘要**

**處理邏輯**：
```typescript
// POST /api/single-episode
const existingSubscription = await findSubscriptionForVideo(videoId, userId);

if (existingSubscription) {
  // 檢查是否已有使用者指定 style/language 的摘要
  const existingSummary = await findSummary(videoId, requestedStyle, requestedLanguage);

  if (existingSummary) {
    // 摘要已存在，直接回傳（不建立 UserSingleEpisode）
    return { status: 'ready', summary: existingSummary, linkedToSubscription: true };
  }

  // 需要產生新摘要，加入 Queue（不建立 UserSingleEpisode，因為已有訂閱）
  await queueSummaryGeneration(videoId, requestedStyle, requestedLanguage);
  return { status: 'queued', linkedToSubscription: true };
}

// 非訂閱頻道的影片，正常建立 UserSingleEpisode
```

**設計理由**：
- 使用者明確選擇不同設定，應尊重其意圖
- 底層 `VideoSummary` 可儲存多版本（以 style + language 為 key）
- 無需彈出確認對話框，減少 UX 摩擦

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
  FAILED       // 永久性失敗，無法產生摘要
}
```

#### 錯誤類型與使用者訊息

| 失敗原因 | 使用者訊息 | 可重試？ |
|----------|-----------|----------|
| 無字幕可用 | 「此影片沒有字幕，無法產生摘要」 | ❌ |
| 年齡限制 | 「此影片有年齡限制，無法處理」 | ❌ |
| 地區限制 | 「此影片在我們的伺服器所在地區無法播放」 | ❌ |
| 影片過長 (>4hr) | 「影片長度超過 4 小時，暫不支援」 | ❌ |
| 暫時性 API 錯誤 | 「處理時發生錯誤，請稍後再試」 | ✅ (自動重試 3 次) |
| 影片已刪除/私人 | 「影片不存在或已設為私人」 | ❌ |

#### 前端處理

```typescript
// 根據 status 顯示不同 UI
switch (singleEpisode.status) {
  case 'PENDING':
  case 'PROCESSING':
    return <ProcessingIndicator />;
  case 'COMPLETED':
    return <SummaryContent summary={singleEpisode.summary} />;
  case 'FAILED':
    return <ErrorMessage reason={singleEpisode.failureReason} />;
}
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

**實作邏輯**：

```typescript
// app/[locale]/feed/user/[token]/route.ts
async function buildFeedItems(userId: string) {
  // 1. 取得使用者的單集記錄（videoId → style/language 對應）
  const singleEpisodes = await prisma.userSingleEpisode.findMany({
    where: { userId },
    select: { videoId: true, style: true, language: true }
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
      // 使用者有單集設定，優先使用
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

  return feedItems.sort((a, b) => b.publishedAt - a.publishedAt);
}
```

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
| 13 | Worker 處理失敗（暫時性錯誤） | 自動重試 3 次後仍失敗才標記 FAILED |

### P1：整合功能

| # | 測試案例 | 預期結果 |
|---|---------|---------|
| 14 | RSS Feed 訂閱 | 單集摘要出現在 Feed 中 |
| 15 | 點擊分享按鈕 | 正確複製公開 URL |
| 16 | 訪問公開頁面 | OG meta 正確、CTA 可見 |
| 17 | 同一影片有訂閱摘要 + 單集摘要 | Feed 中只顯示一次，使用單集設定 |
| 18 | 貼上 YouTube Shorts 連結 | 正確解析並處理 |
| 19 | 貼上含 playlist 參數的連結 | 忽略 playlist，僅處理單一影片 |

---

## 📁 影響檔案清單

| 類別 | 檔案 | 變更類型 |
|------|------|----------|
| **Schema** | `prisma/schema.prisma` | 新增 Model + Enum |
| **Migration** | `prisma/migrations/xxx_add_single_episode_check/migration.sql` | 新增：DB check constraint |
| **API** | `app/api/single-episode/route.ts` | 新增 |
| **API** | `app/api/single-episodes/route.ts` | 新增 |
| **API** | `app/api/single-episodes/[id]/route.ts` | 新增 |
| **Services** | `lib/services/singleEpisode.ts` | 新增：單集業務邏輯（含 polymorphic 驗證） |
| **Services** | `lib/services/urlParser.ts` | 新增/修改：URL 解析（Shorts, Music, playlist 參數） |
| **Worker** | `backend/worker/daemon.py` | 修改：支援新 QueueType |
| **Worker** | `backend/worker/single.py` | 新增：單集處理邏輯 |
| **Services** | `backend/services/youtube_metadata.py` | 依賴：RSS/Scrapetube 取得影片 metadata |
| **Worker** | `backend/worker/transcribe.py` | 依賴：`download_and_transcribe_audio` 函數 |
| **UI** | `components/subscription/ChannelManager/AddChannelForm.tsx` | 重構：統一搜尋欄 |
| **UI** | `components/subscription/ModeSelector.tsx` | 新增：下拉選單元件 |
| **UI** | `components/subscription/SingleEpisodeStatus.tsx` | 新增：狀態顯示元件（PENDING/PROCESSING/COMPLETED/FAILED） |
| **Hook** | `hooks/useSingleEpisodes.ts` | 新增 |
| **Feed** | `app/[locale]/feed/user/[token]/route.ts` | 修改：納入單集、處理多版本摘要優先級 |
| **i18n** | `messages/en.json`, `messages/zh-TW.json` | 新增翻譯鍵值 |
| **Types** | `lib/types.ts` | 擴充 FeedItem 類型、SingleEpisodeStatus |

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
| 訪客是否可看摘要？ | ❌ 需登入後才能看。處理邏輯同訪客訂閱新頻道的流程（參考 [`documents/gwt/frontend_subscription.md` §2 Guest Mode Handling](file:///Users/tomyangdh/youtube-rss-generator/documents/gwt/frontend_subscription.md#L50-L62)：訪客操作 → 跳出 Login Modal → 登入成功後繼續原動作） |
| 單集 vs 訂閱優先級？ | 單集 priority=10，訂閱 priority=0 |
| Placeholder channel 清理？ | 不需要，與退訂頻道相同處理 |
| 已訂閱頻道影片選擇不同 style/language？ | ✅ 尊重使用者選擇，產生新版本摘要（見 §4 風格衝突解決） |
| 同一影片多版本摘要如何顯示？ | Feed 中只顯示一次，單集設定優先於訂閱設定（見 §10 RSS Feed 整合） |
| videoId/episodeId 如何確保互斥？ | DB check constraint + 應用層驗證（見 §資料模型變更） |
| 處理失敗如何處理？ | 新增 `status` 欄位追蹤，定義錯誤類型與訊息（見 §7 處理失敗與錯誤狀態） |

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
