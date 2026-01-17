# RSS Feed 維護守則

> RSS Feed 是系統的核心產品。如果它壞了，用戶無法閱讀內容。

---

## 🚨 快取防護 Headers（必須存在）

所有 RSS feed route（位於 `app/[locale]/feed/`）的 Response **必須**包含以下 headers：

```typescript
return new Response(rssXml, {
    headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        // ===== 以下為快取防護，缺一不可 =====
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Vercel-CDN-Cache-Control': 'no-store, max-age=0',  // Vercel 專用
        'CDN-Cache-Control': 'no-store, max-age=0',          // 其他 CDN
        'Pragma': 'no-cache',                                 // 向下相容
        'Expires': '0',                                       // 向下相容
    },
});
```

**為什麼？**
- `Cache-Control` 只影響瀏覽器
- `Vercel-CDN-Cache-Control` 才能控制 Vercel Edge 層
- 其他 headers 確保所有層級都不快取

---

## 🔀 Middleware Rewrite（必須存在）

RSS feed 路徑必須在 `middleware.ts` 中被 **rewrite**，不可以被 redirect：

```typescript
// middleware.ts
if (req.nextUrl.pathname.startsWith('/feed/user/')) {
    const url = req.nextUrl.clone();
    url.pathname = `/en${req.nextUrl.pathname}`;
    return NextResponse.rewrite(url);  // ✅ rewrite
    // return;                          // ❌ 會 404
    // return NextResponse.redirect()   // ❌ 會 307，RSS Reader 可能不支援
}
```

---

## 📋 RSS Compliance Checklist

修改 Feed 邏輯時，**必須**確保：

1. **Strict XML Structure**
   - `<rss version="2.0" xmlns:itunes="...">` header 存在
   - 所有 user input（Titles, Descriptions）包在 `<![CDATA[ ... ]]>` 中
   - Special characters (`&`, `<`, `>`) 在 CDATA 外要 escape

2. **Podcast Player Requirements** (Apple/Castbox/Pocket Casts)
   - `<itunes:image>`: 有效的 URL
   - `<enclosure>`: 音訊 URL、length (bytes)、type (`audio/mpeg`)
   - `<guid>`: 唯一 ID

---

## ✅ 修改 RSS 前的檢查清單

- [ ] 確認所有 cache headers 都在
- [ ] 確認 `middleware.ts` 的 rewrite 規則沒被動到
- [ ] 確認路由在 `app/[locale]/feed/` 下
- [ ] 部署後用 `curl -I` 測試

---

## 🧪 快速驗證

```bash
# 1. 確認沒有 307 redirect
curl -I "https://youtube-rss-generator.vercel.app/feed/user/YOUR_TOKEN/channel/12"
# 期望: HTTP/2 200

# 2. 確認快取 headers
curl -I "https://youtube-rss-generator.vercel.app/en/feed/user/YOUR_TOKEN/channel/12" | grep -i cache
# 期望: cache-control: no-cache, no-store, must-revalidate
```

---

## 📁 相關檔案

| 檔案 | 用途 |
|------|------|
| `middleware.ts` | RSS rewrite 規則 |
| `lib/rss-utils.ts` | RSS 共用工具（分享連結 footer） |
| `app/[locale]/feed/user/[token]/route.ts` | 主 feed |
| `app/[locale]/feed/user/[token]/channel/[channelId]/route.ts` | 單一頻道 feed |
| `app/[locale]/feed/user/[token]/podcast/[podcastId]/route.ts` | 單一 podcast feed |

