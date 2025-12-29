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

#### ⚠️ 關鍵行為 (Critical Invariants)

1. **Optimistic Update 必須使用負數 ID**
   - 在 `onMutate` 中建立的樂觀資料，其 `id` 必須為負數（如 `-Date.now()`）。
   - 在 `onSuccess` 中過濾 `id > 0` 來移除樂觀資料。
   - **違反後果**：樂觀資料不會被正確替換，造成重複卡片。

2. **`onSuccess` 必須直接更新 Cache**
   - 不要依賴 `invalidateQueries` 來更新 `subscriptions` cache。
   - 使用 `setQueryData` 直接合併 API 回傳的真實資料。
   - **違反後果**：Race Condition，卡片消失後需手動重整。

3. **API Response 必須包含完整 Subscription 物件**
   - `/api/channels` 和 `/api/podcasts` 的 POST 回傳必須包含 `subscription` 欄位。
   - `subscription` 必須包含巢狀的 `channel` 或 `podcast` 物件。
   - **違反後果**：`onSuccess` 無法正確更新 cache。

### `hooks/useFeed.ts`

| Export | 類型 | 職責 |
|--------|------|------|
| `useFeed(filter)` | Infinite Query | 取得摘要 Feed，支援分頁 |

#### ⚠️ 關鍵行為

1. **Query Key 包含 filter**
   - `['feed', filter]`：切換 filter 時會自動 refetch。
   - **違反後果**：切換 filter 後顯示錯誤資料。

### `components/subscription/ChannelManager/useChannelManager.ts`

| 狀態/函式 | 職責 |
|-----------|------|
| `displayChannels` | 計算要顯示的頻道列表（排除樂觀刪除的） |
| `optimisticDeletedIds` | 追蹤正在刪除中的項目（格式：`"youtube-123"` 或 `"podcast-456"`） |
| `confirmUnsubscribe()` | 執行刪除，樂觀隱藏卡片 |

#### ⚠️ 關鍵行為

1. **`optimisticDeletedIds` 使用字串格式**
   - 格式：`"${type}-${id}"`（如 `"youtube-12"`）
   - **原因**：避免 YouTube 和 Podcast ID 衝突。
   - **違反後果**：刪除 YouTube ID 12 會意外隱藏 Podcast ID 12。

2. **`optimisticDeletedIds` 由 `useEffect` 自動清理**
   - 當 `initialChannels` 或 `initialPodcasts` 更新且不再包含該 ID 時，自動清除。
   - **不要手動清除**，除非是錯誤 rollback。
   - **違反後果**：手動清除會造成「閃爍」（卡片短暫重現後消失）。

3. **displayChannels 依賴 `initialChannels` props**
   - 資料來源是 React Query cache，透過 `SubscriptionsPage` 傳入。
   - 修改 `useSubscriptions` 的 cache 會自動影響 `displayChannels`。

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
        │
        ├──▶ onMutate: 加入樂觀資料 (id < 0) 到 cache
        │
        ├──▶ mutationFn: POST /api/channels
        │           │
        │           ▼
        │      API 回傳 { subscription: {..., channel: {...}} }
        │
        ├──▶ onSuccess: 用真實資料替換樂觀資料
        │
        └──▶ onSettled: invalidateQueries(['feed'])
                        (讓 Feed 頁面更新)
```

### 刪除頻道流程

```
User confirms delete
        │
        ▼
useChannelManager.confirmUnsubscribe()
        │
        ├──▶ 加入 "youtube-{id}" 到 optimisticDeletedIds
        │    (卡片立即從 displayChannels 消失)
        │
        ├──▶ DELETE /api/channels
        │
        ├──▶ invalidateQueries(['subscriptions'])
        │           │
        │           ▼
        │      新資料不含該頻道
        │           │
        │           ▼
        │      useEffect 偵測到 ID 不存在於 props
        │           │
        │           ▼
        └──▶ 自動從 optimisticDeletedIds 移除該 ID
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
- [ ] 是否會影響 `optimisticDeletedIds` 的格式或清理邏輯？
- [ ] 是否修改了 API 回傳格式？（需同步更新 `onSuccess`）
- [ ] 修改後，上述測試案例 T1-T7 是否仍然通過？
