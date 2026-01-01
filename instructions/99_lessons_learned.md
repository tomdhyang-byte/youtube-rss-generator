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

### YouTube Rate Limits
- `youtube-transcript-api` 太頻繁會被 IP ban
- Worker 有內建 cooldown logic，不要移除 `sleep` calls

---

## ✅ 每次改動前的檢查清單

- [ ] API 回傳型別變更時，是否更新了所有使用該 API 的 hook/type 定義？
- [ ] Merge conflict 後，是否理解 remote 的變更內容？
- [ ] 是否執行 `npm run build` 確認編譯通過？
- [ ] 修改 prompts 後，是否測試了 output format？
