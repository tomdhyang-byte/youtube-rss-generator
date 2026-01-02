<!--
AI 維護指南：
此 README 充當 Vibe Coder (使用者) 的混合「操作手冊」和 AI 的「上下文來源」。
更新此檔案時：
1. UI 元件速查表：每當建立新的可重複使用 UI 元件時，必須更新此處。提供便於複製貼上的範例。
2. 快速操作：保持此列表簡潔。僅新增高頻率指令。
3. 技術堆疊：保持嚴格的版本號 (例如 Next.js 16) 以協助 AI 產生相容的程式碼。
-->

# TubeSummary - AI 驅動的 YouTube 與 Podcast 閱讀器

> **概念**：不再為了尋找一個觀點而觀看 20 分鐘的影片。TubeSummary 利用 AI 將 YouTube 頻道和 Podcast 轉變為可閱讀的高訊號新聞資訊流。

## 🎯 專案目標

本專案的目標是將「觀看/聆聽」這種被動、耗時的體驗，轉變為「閱讀」這種主動、高效的體驗。

透過在這裡訂閱頻道，而不是在 YouTube 上：
1.  **節省時間**：閱讀 2 分鐘的 AI 摘要，而不是觀看 20 分鐘的影片。
2.  **避免干擾**：沒有演算法、沒有 Shorts、沒有推薦。只有你訂閱的內容。
3.  **統一資訊流**：在一個乾淨的時間軸中閱讀你的科技 YouTube 頻道和歷史 Podcast。

---

## ✨ 關鍵功能

### 1. 網頁閱讀介面
-   **乾淨的時間軸**：所有訂閱內容的統一資訊流。
-   **即時閱讀**：點擊任何卡片即可在無縫的視窗中即時開啟 AI 摘要。
-   **閱讀追蹤**：自動將你已閱讀的卡片變暗。

### 2. 隱私優先的「訪客模式」
-   無需建立帳戶即可試用應用程式。
-   你的第一個訂閱儲存在瀏覽器的本地端 (`localStorage`)。
-   只有當你想跨裝置同步或新增更多頻道時，才需要使用 Google 登入。

### 3. AI 處理
-   **多層次逐字稿擷取 (YouTube)**：
    1.  免費 `youtube-transcript-api` (速率限制：10次/天，30分鐘冷卻)
    2.  Supadata API (付費備援)
    3.  Deepgram + yt-dlp (針對無字幕影片)
-   **Podcast 轉錄**：Deepgram 語音轉文字。
-   **情境摘要**：使用 GPT-4o 產生結構化摘要，捕捉 *洞見* 而不僅僅是逐字稿。

### 4. 摘要風格
-   **選擇你的風格**：每個訂閱可選擇 2 種 AI 摘要風格：
    -   📚 **深度筆記** (預設)：適合學習的完整結構化摘要
    -   ⚡ **快速閱讀**：簡潔重點，30 秒掌握結論
-   **前瞻性**：風格變更僅影響 *未來* 的內容，保持 RSS feed 的穩定性。

### 5. 國際化 (i18n)
-   **多語言介面**：完整的雙語介面 (English / 繁體中文)
-   **多語言摘要**：每個訂閱可選擇偏好的摘要語言 (例如用中文閱讀英文科技新聞)。
-   **自動偵測**：預設為你的介面語言，可完全自定義。
-   **在地化內容**：所有 UI 元素、提示訊息和對話框皆已翻譯

---

## 🧩 UI 元件速查表

使用這些預建元件來保持 UI 一致性。

### Button (按鈕)
```tsx
import { Button } from "@/components/ui/Button";

// Variants: primary (orange), secondary (blue), ghost, danger, outline
<Button variant="primary" size="md" onClick={handleClick} loading={isLoading}>
  確認動作
</Button>
```

### IconButton (圖示按鈕)
```tsx
import { IconButton } from "@/components/ui/IconButton";
import { Trash2 } from "lucide-react";

// Variants: default, danger, warning, muted
<IconButton variant="danger" aria-label="刪除" onClick={handleDelete}>
  <Trash2 className="w-5 h-5" />
</IconButton>
```

### Input (輸入框)
```tsx
import { Input } from "@/components/ui/Input";

<Input 
  label="電子郵件" 
  placeholder="輸入電子郵件..." 
  error={errorMessage} // 顯示紅色邊框 + 錯誤文字
  fullWidth 
/>
```

### Badge (徽章)
```tsx
import { Badge } from "@/components/ui/Badge";

// Variants: default, success, warning, danger, info, youtube, podcast
<Badge variant="youtube">YouTube</Badge>
```

### StyleSelector (風格選擇器)
```tsx
import { StyleSelector, SummaryStyle } from "@/components/ui/StyleSelector";

// 用於訂閱層級的風格選擇
<StyleSelector
  value={currentStyle}
  onChange={(style: SummaryStyle) => handleStyleChange(style)}
/>
```

---

## 🚀 快速開始

### 1. 訪問應用程式
前往 `http://localhost:3000` (如果是在本地執行)。

### 2. 訂閱 (無需登入)
在登陸頁面的輸入框中貼上 YouTube 網址 (例如 `https://youtube.com/@mkbhd`)。

### 3. 閱讀
AI 將會處理最新的影片 (新頻道通常需要約 5 分鐘)。完成後，它們會出現在你的資訊流中。

---

## 🛠 給開發者

本專案是開源的，並使用現代網頁技術構建。

-   **前端**: Next.js 16, React Query, Tailwind CSS
-   **UI 元件**: 自定義元件庫 (Button, IconButton, Input, Badge) + Shadcn
-   **後端**: Python Worker, OpenAI, Supabase (PostgreSQL)

👉 **[閱讀代碼結構與架構說明](CODE_STRUCTURE.md)** 以深入了解程式碼結構、資料庫架構和資料流。

### 快速設定

```bash
# 1. 安裝依賴
npm install

# 後端依賴
cd backend
pip install -r requirements.txt  # 包含 youtube-transcript-api
cd ..

# 2. 設定環境變數
cp .env.example .env
# (填入你的 API keys)

# 3. 執行前端
npm run dev

# 4. 執行 Worker (在分開的終端機)
# 注意：確保你在根目錄
npm run worker
# (或手動執行：./backend/run_worker.sh)
```

---

## 📡 RSS Feed 支援

除了網頁閱讀器之外，你也可以在任何閱讀器應用程式 (例如 Readwise Reader, Reeder) 中透過 RSS feed 訂閱內容。

| 類型 | URL 模式 | 描述 |
|------|-------------|-------------|
| **個人化 Feed** | `/feed/user/[feedToken]` | 你的統一資訊流，鎖定摘要風格，現在具有特定頻道的圖示。 |

> **注意**：個人化 feed 使用你的 `feedToken` (可在你的帳戶中找到)，並尊重你在處理每個影片/單集時所選擇的摘要風格。

---

## 🔑 環境變數

查看 `.env.example` 以獲取必要的金鑰：
-   `DATABASE_URL`, `DIRECT_URL` (Supabase)
-   `OPENAI_API_KEY`, `SUPADATA_API_KEY`, `DEEPGRAM_API_KEY`
-   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (用於驗證)
