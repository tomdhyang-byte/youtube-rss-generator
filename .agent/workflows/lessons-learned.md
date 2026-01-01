---
description: 記錄 AI 犯過的錯誤和教訓，改動程式碼前請先閱讀
---

# AI 錯誤記錄與教訓

## 使用方式

改動程式碼前，請 AI 先閱讀此文件：
```
請先閱讀 /lessons-learned 並確保不重蹈覆轍
```

---

## 錯誤記錄

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

## 檢查清單

每次改動前，確認以下事項：

- [ ] API 回傳型別變更時，是否更新了所有使用該 API 的 hook/type 定義？
- [ ] Merge conflict 後，是否理解 remote 的變更內容？
- [ ] 是否執行 `npm run build` 確認編譯通過？
