---
description: Guardrails and best practices for modifying useSubscriptions, useChannelManager, and related hooks
---

# Hooks 架構與行為規範

> **目的**：提供 AI 助手或開發者在修改程式碼時的參考依據，避免「改 A 壞 B」的情況。

## 🏗️ 架構概覽

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
                              │ calls
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        API Routes                            │
│  /api/channels, /api/subscriptions, /api/feed               │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Hook 清單與職責

### `hooks/useSubscriptions.ts`

| Export | 類型 | 職責 |
|--------|------|------|
| `useSubscriptions()` | Query | 取得使用者的 YouTube 和 Podcast 訂閱列表 |
| `useAddChannelMutation()` | Mutation | 新增 YouTube 頻道（含樂觀更新） |
| `useAddPodcastMutation()` | Mutation | 新增 Podcast（含樂觀更新） |
| `useDeleteChannelMutation()` | Mutation | 刪除 YouTube 頻道（含樂觀更新） |
| `useDeletePodcastMutation()` | Mutation | 刪除 Podcast（含樂觀更新） |

#### ⚠️ 關鍵行為 (Critical Invariants)

1. **Optimistic Update 必須使用負數 ID**
   - 在 `onMutate` 中建立的樂觀資料，其 `id` 必須為負數（如 `-Date.now()`）。
   - 在 `onSuccess` 中過濾 `id > 0` 來移除樂觀資料。

2. **`onSuccess` / `onMutate` 必須直接更新 Cache**
   - 新增：在 `onSuccess` 用 `setQueryData` 合併真實資料。
   - 刪除：在 `onMutate` 用 `setQueryData` 預先移除項目。
   - 不要依賴 `invalidateQueries` 來做主要的 UI 更新（太慢）。

3. **API Response 必須包含完整 Subscription 物件**
   - POST 回傳必須包含完整 `subscription` 欄位以更新 cache。

### `hooks/useFeed.ts`

| Export | 類型 | 職責 |
|--------|------|------|
| `useFeed(filter)` | Infinite Query | 取得摘要 Feed，支援分頁 |

### `components/subscription/ChannelManager/useChannelManager.ts`

| 狀態/函式 | 職責 |
|-----------|------|
| `displayChannels` | **直接反映** `initialChannels` (cache) |
| `confirmUnsubscribe()` | 呼叫 delete mutation |

> **注意**：不再使用 `optimisticDeletedIds` 或 `useEffect` 來管理刪除狀態。所有 UI 狀態完全由 React Query cache 驅動。

## 🔄 資料流圖

### 新增頻道流程

```
User clicks "Add Channel"
        │
        ▼
useChannelManager.handleYouTubeSubmit()
        │
        ▼
useAddChannelMutation.mutate()
        ├──▶ onMutate: 加入樂觀資料 (id < 0)
        ├──▶ mutationFn: POST /api/channels
        └──▶ onSuccess: 用真實資料替換
```

### 刪除頻道流程

```
User confirms delete
        │
        ▼
useChannelManager.confirmUnsubscribe()
        │
        ▼
useDeleteChannelMutation.mutate()
        │
        ├──▶ onMutate: 直接從 React Query cache 移除該項目
        │    (卡片立即從 UI 消失，因為 displayChannels 變了)
        │
        ├──▶ mutationFn: DELETE /api/channels
        │
        └──▶ onError: 如失敗則 Rollback (卡片復原)
```

## 🧪 測試案例清單

以下是應該覆蓋的關鍵測試案例：

| ID | 測試名稱 | 預期行為 |
|----|----------|----------|
| T1 | 新增頻道 - 樂觀更新 | 點擊新增後，立即顯示「新增中...」卡片 |
| T2 | 新增頻道 - 成功替換 | API 成功後，樂觀卡片變成真實卡片，無閃爍 |
| T3 | 新增頻道 - 失敗 rollback | API 失敗後，樂觀卡片消失，顯示 toast 錯誤 |
| T4 | 刪除頻道 - 樂觀隱藏 | 確認刪除後，卡片立即消失 |
| T5 | 刪除頻道 - 無閃爍 | 刪除過程中卡片不會短暫重現 |
| T6 | 刪除後重新訂閱 | 重新訂閱同一頻道，卡片正常顯示 |
| T7 | 語系切換 - 樂觀卡片 | 中文 UI 下，樂觀卡片顯示「新增頻道中...」 |

## 📝 修改前檢查清單

在修改任何 Hook 前，請確認：

- [ ] 是否會影響 React Query cache 結構？
- [ ] 是否會改變 `onSuccess` 或 `onMutate` 的行為？
- [ ] 是否修改了 API 回傳格式？（需同步更新 `onSuccess`）
- [ ] 修改後，上述測試案例 T1-T7 是否仍然通過？
