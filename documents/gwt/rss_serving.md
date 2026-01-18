# RSS Serving GWT

> **Purpose**: 定義 RSS Feed 路由層 (`app/[locale]/feed/...`) 的行為規範，確保 RSS Reader 能正確讀取且不被錯誤快取。

---

## 1. Response Headers & Caching

### Cache Prevention
> **Rationale**: 
> RSS Feed 是動態內容，且用戶依賴它獲取最新影片。如果不嚴格禁止快取，CDN 或瀏覽器可能會給用戶舊的 Feed，導致用戶以為系統壞了。

```gherkin
Given RSS Feed 被請求
When Server 回傳 Response
Then **必須**包含以下 Headers:
  - Cache-Control: 'no-cache, no-store, must-revalidate' (Browser)
  - Vercel-CDN-Cache-Control: 'no-store, max-age=0'     (Vercel Edge)
  - CDN-Cache-Control: 'no-store, max-age=0'            (Other CDNs)
  - Pragma: 'no-cache'                                  (Legacy)
  - Expires: '0'                                        (Legacy)
```

### Content Type
```gherkin
Given RSS Feed 被請求
Then Content-Type 必須為: 'application/rss+xml; charset=utf-8'
```

---

## 2. Middleware Routing

### URL Rewrite (Not Redirect)
> **Rationale**: 
> 為了支援多語系 (next-intl)，Next.js 把路由放在 `app/[locale]/feed/...`。但我們發給用戶的 URL 是不帶 locale 的 (簡潔)。
> **絕對不能**用 307 Redirect 跳轉，因為很多老舊的 RSS Reader 不支援轉址，或會把轉址視為網址變更。必須用 Server-Side Rewrite。

```gherkin
Given 用戶請求 `/feed/user/{token}/...`
When Request 進入 middleware.ts
Then **Rewrite** (URL 不變) 到 `/en/feed/user/{token}/...`
And **不要**使用 Redirect
```

---

## 3. RSS Compliance

### XML Structure
> **Rationale**: 
> 相容性至上。Podcast Player (如 Apple Podcasts) 對 XML 格式非常挑惕，一點錯誤就無法解析。

```gherkin
Given 產生 XML 內容
Then 必須符合 RSS 2.0 規範 (`version="2.0"`)
And 包含正確的 namespaces (`xmlns:itunes`, `xmlns:content`)
And 所有 User Input (標題、描述) 必須包在 `<![CDATA[ ... ]]>` 中
And 特殊字元 (`&`, `<`, `>`) 在 CDATA 之外必須 Escape
```

### Podcast Specifics
```gherkin
Given Podcast Feed
Then 必須包含 `<enclosure>` 標籤:
  - url: 音檔直連網址
  - type: 'audio/mpeg'
  - length: 檔案大小 (bytes)
And 必須包含 `<guid>` (唯一識別碼)
And 必須包含 `<itunes:image>` (封面圖)
```

---

## 4. Operational Checklist (Deploy Check)

> **Rationale**: 每次修改 Feed 邏輯後的必測項目。

```bash
# 1. 驗證沒有 307 Redirect (必須是 200)
curl -I "https://your-domain.com/feed/user/TOKEN/channel/ID"

# 2. 驗證 Cache Headers (必須包含 no-store)
curl -I "https://your-domain.com/feed/user/TOKEN/channel/ID" | grep -i cache
```
