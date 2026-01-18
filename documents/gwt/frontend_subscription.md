# Frontend Subscription GWT

> **Purpose**: 定義前端訂閱管理模組的行為規範，特別是 Optimistic UI 與訪客模式的邊界邏輯。

---

## 1. Subscription Management (`useSubscriptions.ts`)

### Add Channel (Optimistic Update)
> **Rationale**: 
> 提升 "Perceived Performance" (感知效能)。用戶按下「新增」時，不應該讓他乾等 1-2 秒的 API 來回時間。我們先在 UI 上 "騙" 他說已經成功了 (顯示一個假的 Card)，後台再慢慢處理。

```gherkin
Given 用戶輸入有效的 YouTube/Podcast URL
When 點擊 "Subscribe" 按鈕
Then **立即** (onMutate) 執行:
  1. 取消正在進行的 `subscriptions` query (避免 race condition)
  2. 產生一個負數 ID (e.g., -17100000) 的 Fake Subscription
  3. 將此 Fake Subscription 插入 React Query Cache 的最前方
  4. UI 立即渲染出新卡片 (顯示 Loading 狀態或預設標題)
And 背景發送 POST API 請求
And **成功時** (onSuccess):
  - 用 API 回傳的真實 Subscription (正數 ID) 替換掉 Fake Subscription
And **失敗時** (onError):
  - Rollback Cache 到 mutation 前的狀態
  - 顯示 Toast Error 告知用戶失敗原因
```

### Delete Channel (Optimistic Delete)
> **Rationale**: 
> 刪除是一個低風險動作，用戶預期它會立刻消失。如果刪除還要有 Loading Spinner，體驗會很差。

```gherkin
Given 用戶點擊 "Unsubscribe" 並在 Dialog 確認
When 確認刪除
Then **立即** (onMutate) 執行:
  1. 從 Cache 中過濾掉該 ID 的 Subscription
  2. 更新 Cache 中的 Quota count (current - 1)
  3. UI 上的卡片立即移除
And 背景發送 DELETE API 請求
And **失敗時** (onError):
  - Rollback Cache (卡片會跳回來)
  - 顯示 Toast Error

### Single Episode Submission
> **Rationale**: 
> 單集處理流程較長（下載 -> 轉錄 -> 摘要），且不屬於「訂閱」範疇。因此採用 "Task Queue" 模式，用戶提交後會看到即時的狀態變化，而非 Optimistic UI。

```gherkin
Given 用戶選擇 "Single Episode" 模式
And 輸入有效 URL 並選擇 Style/Language
When 點擊 "Generate Summary"
Then **立即**顯示 "Submitting..." 狀態
And 背景發送 POST `/api/single-episode`
And **成功時** (onSuccess):
  - 顯示 "Queued" 狀態與 "Check Status" 連結
  - (Optional) 在 "Collections" Tab 顯示新項目 (Pending)
And **失敗時** (onError):
  - 顯示錯誤原因 (e.g., 不支援 Shorts, 無字幕)
```
```

---

## 2. User Interface (`ChannelManager/index.tsx`)

### Guest Mode Handling (Local Storage)
> **Rationale**: 
> 降低使用門檻 ("Try before you buy")。允許未登入用戶體驗功能，但為了成本控制與推廣註冊，限制只能訂閱 1 個頻道，且資料只存在瀏覽器。

```gherkin
Given 用戶未登入 (Session is null)
When 嘗試訂閱頻道
Then 檢查 `localChannels` 長度
  - 若 >= 1 → 阻擋並跳出 Login Modal
  - 若 < 1 → 呼叫 `/api/channel-info` (Proxy) 獲取 metadata
And 將頻道資訊存入 `useLocalStorage` ('guest_channels')
And UI 顯示 "Sign in to save permanently" 的提示
```

### Style/Language Updates (Optimistic)
> **Rationale**: 
> 這些是輕量級的偏好設定，用戶預期它是即時生效的。

```gherkin
Given 用戶在卡片上切換 Style 或 Language 下拉選單
When 選擇新值
Then **立即**更新 Local State (`optimisticStyles` / `optimisticLanguages`)
And UI 顯示新的選擇
And 背景發送 PATCH `/api/subscriptions/style`
And **成功時**: Invalidate Query (讓 Server 數據同步)
And **失敗時**: Rollback Local State (UI 跳回舊值) + Toast Error
```

---

## 3. Quota & Permissions

### Add Button Availability
> **Rationale**: 
> 在前端先做一層防守，避免用戶做無效的點擊。

```gherkin
Given 從 API 獲取 `quota` 物件
When 渲染 "Add Channel" 區域
Then 判斷 `canAddMore`:
  - 若 `!quota` (Loading) → Disable Input
  - 若 `quota.isAdmin` → Enable (無限)
  - 若 `quota.current < quota.limit` → Enable
  - 若 `quota.current >= quota.limit` → Disable Input & Show Limit Message

---

## 4. Technical Implementation Notes (Hooks Architecture)

> **Context**: 提供前端工程師在維護 Hook 時的技術指引與行為準則。

### Component Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                        UI Components                         │
│  (ChannelManager, FeedPage, SubscriptionsPage)              │
└─────────────────────────────────────────────────────────────┘
                              │ uses
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Component Hooks                          │
│  useChannelManager - UI state, form handling, modals        │
└─────────────────────────────────────────────────────────────┘
                              │ uses
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    React Query Hooks                         │
│  useSubscriptions, useFeed, useAddChannelMutation           │
│  - Data fetching, caching, optimistic updates               │
└─────────────────────────────────────────────────────────────┘
```

### Critical Invariants (Hook Rules)

1.  **Optimistic Update 必須使用負數 ID**
    *   在 `onMutate` 中建立的 fake subscription，ID 必須為負數 (e.g. `-Date.now()`)。
    *   這確保了 UI 可以區分「真實資料」與「預期資料」，且在渲染 list 時 key 也不會衝突。

2.  **更新 Cache 策略**
    *   **新增/刪除**: 優先使用 `setQueryData` 直接修改 cache，而不是只依賴 `invalidateQueries`。
    *   **理由**: `invalidateQueries` 會觸發 refetch，雖然保證數據正確，但會有網路延遲，無法達到「即時」的體感。

3.  **API Response 完整性**
    *   後端 API (POST) 必須回傳完整的 Subscription 物件。
    *   前端 `onSuccess` 收到後，用這個真實物件替換掉之前的負數 ID 物件。

### Data Flow Examples

**Add Channel Flow**:
```
User clicks "Add" -> useChannelManager -> useAddChannelMutation
    ├─ onMutate: 插入負數 ID 資料 (Cache Updated) -> UI Update
    ├─ mutationFn: POST /api/channels
    └─ onSuccess: 用真實 ID 替換負數 ID (Cache Updated)
```

**Delete Channel Flow**:
```
User clicks "delete" -> useDeleteChannelMutation
    ├─ onMutate: 從 Cache 移除該 ID -> UI Update
    ├─ mutationFn: DELETE /api/channels
    └─ onError: Rollback (把剛才移除的加回來)
```
```
