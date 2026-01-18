# TubeSummary 手機 App - 技術規格

> **目標**：打造一個跨平台（iOS + Android）的 TubeSummary 手機應用，提供 Reeder 級別的絲滑閱讀體驗。

---

## 📌 專案背景與決策

### 為什麼要做手機 App？

1. **更好的閱讀體驗**：手機上的原生 App 可以提供比 PWA 更流暢的手勢操作與動畫
2. **離線閱讀**：用戶可以在通勤時閱讀已快取的摘要
3. **習慣養成**：App icon 在主畫面提醒用戶每日閱讀

### 技術選型決策

| 選項 | 評估結果 |
|------|----------|
| **Flutter (Dart)** ✅ | 選用。動畫流暢度最佳，雙平台一份代碼 |
| React Native | 備選。列表滾動性能較差，需額外調優 |
| Swift (iOS only) | 不採用。無法兼顧 Android 用戶 |

### 架構決策

| 決策項目 | 選擇 | 原因 |
|---------|------|------|
| **Repo 結構** | Monorepo（`mobile/` 資料夾） | AI 可同時維護 Web + App，API 同步更容易 |
| **認證方式** | 新增 `/api/auth/mobile-token` | 最小化後端改動，不影響現有 Web 用戶 |
| **Push 通知** | Phase 2（不在 MVP 範圍） | 降低首版複雜度 |

---

## 🎯 業務目標

```
用戶下載 App → 登入 Google → 看到訂閱 Feed → 每天閱讀摘要 → 長期留存
```

### MVP 成功指標

- [ ] 可在 App Store / Google Play 上架
- [ ] 核心功能（訂閱、閱讀、管理）正常運作
- [ ] 無 crash 回報（Crashlytics 0 關鍵錯誤）

---

## 📦 功能模組

| 模組 | 優先級 | 狀態 | 說明 |
|------|--------|------|------|
| Google 登入 | P0 | 🔲 待開發 | 使用 Google Sign-In + 後端 Token 交換 |
| Feed 列表 | P0 | 🔲 待開發 | 無限滾動、下拉刷新、已讀標記 |
| 文章閱讀器 | P0 | 🔲 待開發 | Hero 動畫、Markdown 渲染 |
| 訂閱管理 | P0 | 🔲 待開發 | 新增/刪除頻道、Style 選擇 |
| 離線快取 | P1 | 🔲 待開發 | 快取最近 50 篇摘要 |
| 深色模式 | P1 | 🔲 待開發 | 跟隨系統設定 |
| Mobile Auth API | P0 | 🔲 待開發 | **唯一後端改動** |

---

## 🏗️ 系統架構

### 整體架構圖

```
youtube-rss-generator/           # 現有 Repo
├── app/                         # Next.js (Web)
├── backend/                     # Python Worker
├── prisma/                      # DB Schema
│
└── mobile/                      # 【新增】Flutter App
    ├── lib/
    │   ├── main.dart            # Entry point
    │   ├── config/              # API URLs, Theme
    │   ├── models/              # Data models (對應 Web types)
    │   ├── services/            # API Client, Auth, Cache
    │   ├── providers/           # Riverpod state management
    │   └── screens/             # UI screens
    ├── ios/
    ├── android/
    └── pubspec.yaml
```

### 資料流

```
┌─────────────────────────────────────────────────────────────┐
│                      現有後端 (幾乎不動)                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │ Python      │    │ Supabase    │    │ Next.js API     │  │
│  │ Worker      │◄──►│ PostgreSQL  │◄──►│ (現有 Routes)   │  │
│  └─────────────┘    └─────────────┘    └─────▲───────────┘  │
│                                               │              │
│                         ┌─────────────────────┘              │
│                         │ 【新增】                            │
│                         ▼                                    │
│              ┌─────────────────────┐                         │
│              │ /api/auth/mobile    │◄─── Google ID Token     │
│              │ (Token 交換)         │───► JWT for App         │
│              └─────────────────────┘                         │
└──────────────────────────────────────────────────────────────┘
                              ▲ HTTPS
                              │
┌─────────────────────────────┼────────────────────────────────┐
│                   Flutter App                                │
│  ┌──────────────────────────┴─────────────────────────────┐  │
│  │                   Presentation Layer                    │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │  │
│  │  │ 登入畫面  │  │ Feed 列表 │  │ 文章閱讀器 / 訂閱管理 │  │  │
│  │  └──────────┘  └──────────┘  └──────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    State (Riverpod)                      │  │
│  │  AuthProvider │ FeedProvider │ SubscriptionProvider      │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    Data Layer                            │  │
│  │  API Client (Dio) │ Auth Service │ Cache (Hive)          │  │
│  └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔧 技術實作細節

### 1. Mobile Auth API（後端唯一改動）

> ⚠️ **重要**：這是整個專案「唯一需要動到後端的地方」。此 API 不會影響現有 Web 用戶。

**檔案**: `app/api/auth/mobile/route.ts`（新增）

**流程**：
1. 用戶在手機按「Google 登入」
2. 拿到 Google 的 `idToken`
3. 呼叫 `POST /api/auth/mobile` 送出 token
4. 後端驗證 → 查找或建立 User → 回傳 JWT
5. 手機儲存 JWT，後續 API 請求都帶 `Authorization: Bearer {jwt}`

**實作參考**：

```typescript
// app/api/auth/mobile/route.ts
import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function POST(request: Request) {
    const { idToken } = await request.json();

    // 1. Verify Google ID Token
    const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 2. Find or create user
    let user = await prisma.user.findUnique({
        where: { email: payload.email },
    });
    if (!user) {
        user = await prisma.user.create({
            data: {
                email: payload.email,
                name: payload.name,
                image: payload.picture,
            },
        });
    }

    // 3. Generate JWT for mobile
    const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: '30d' }
    );

    return NextResponse.json({
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            tier: user.tier,
        },
    });
}
```

**環境變數需新增**：
```bash
# .env
JWT_SECRET=your-secure-random-string-at-least-32-chars
```

---

### 2. API 權限驗證中間件

> 新增一個 helper 函式來驗證 mobile JWT。

**檔案**: `lib/auth-mobile.ts`（新增）

```typescript
import jwt from 'jsonwebtoken';

interface MobilePayload {
    userId: string;
    email: string;
}

export function verifyMobileToken(authHeader: string | null): MobilePayload | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.replace('Bearer ', '');
    try {
        return jwt.verify(token, process.env.JWT_SECRET!) as MobilePayload;
    } catch {
        return null;
    }
}
```

**更新現有 API Routes**：

為了讓現有的 API（如 `/api/feed`）同時支援 Web session 和 Mobile JWT，需要修改 `getSession` 的使用方式：

```typescript
// 在 API route 中
import { getSession } from '@/lib/auth';
import { verifyMobileToken } from '@/lib/auth-mobile';

export async function GET(request: Request) {
    // Try Web session first
    let session = await getSession();
    let userId: string | null = session?.user?.id || null;

    // If no web session, try mobile token
    if (!userId) {
        const authHeader = request.headers.get('authorization');
        const mobilePayload = verifyMobileToken(authHeader);
        userId = mobilePayload?.userId || null;
    }

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ... rest of the API logic using userId
}
```

> 💡 **建議**：可建立一個 `getAuthenticatedUser(request)` helper 來封裝這段邏輯。

---

### 3. Flutter 專案結構

**檔案**: `mobile/pubspec.yaml`

```yaml
name: tubesummary
description: AI-powered YouTube & Podcast reader
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  # State Management
  flutter_riverpod: ^2.4.0
  riverpod_annotation: ^2.3.0
  # Networking
  dio: ^5.4.0
  # Auth
  google_sign_in: ^6.2.0
  flutter_secure_storage: ^9.0.0
  # Local Cache
  hive_flutter: ^1.1.0
  # UI
  cached_network_image: ^3.3.0
  flutter_markdown: ^0.6.18
  shimmer: ^3.0.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  riverpod_generator: ^2.3.0
  build_runner: ^2.4.0
```

---

### 4. API 對應表

| Web API | 功能 | Mobile 呼叫方式 |
|---------|------|-----------------|
| `GET /api/feed` | 取得 Feed | ✅ 帶 JWT Header |
| `GET /api/subscriptions` | 取得訂閱列表 | ✅ 帶 JWT Header |
| `POST /api/channels` | 新增 YouTube 頻道 | ✅ 帶 JWT Header |
| `POST /api/podcasts` | 新增 Podcast | ✅ 帶 JWT Header |
| `DELETE /api/channels` | 刪除 YouTube 訂閱 | ✅ 帶 JWT Header |
| `PATCH /api/subscriptions/style` | 變更摘要風格 | ✅ 帶 JWT Header |
| `POST /api/single-episode` | 單集處理請求 | ✅ 帶 JWT Header |
| `POST /api/auth/mobile` | **新增** - Token 交換 | 🆕 不需 JWT |

---

### 5. Flutter 畫面規格

#### 5.1 登入畫面

```
┌─────────────────────────────┐
│                             │
│         TubeSummary         │
│           [Logo]            │
│                             │
│   AI-powered RSS Reader     │
│                             │
│  ┌───────────────────────┐  │
│  │  Sign in with Google  │  │
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘
```

- 按鈕使用 Google Sign-In 官方樣式
- 登入成功後自動跳轉 Feed

#### 5.2 Feed 列表

```
┌─────────────────────────────┐
│  TubeSummary     [Profile]  │
├─────────────────────────────┤
│  ┌─────────────────────────┐│
│  │ [Thumb] Title           ││
│  │         Source • 2h ago ││
│  │         Preview text... ││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │ [Thumb] Title           ││
│  │         ...             ││
│  └─────────────────────────┘│
│  ...                        │
├─────────────────────────────┤
│  [Feed]  [Subs]  [Settings] │
└─────────────────────────────┘
```

- 下拉刷新 → 呼叫 `GET /api/feed`
- 無限滾動 → 使用 cursor pagination
- 已讀文章 → 降低 opacity

#### 5.3 文章閱讀器

```
┌─────────────────────────────┐
│  ← Back           [Share]   │
├─────────────────────────────┤
│                             │
│  [Thumbnail 大圖]            │
│                             │
│  Article Title              │
│  Source • Jan 18, 2026      │
│                             │
│  [Markdown Summary Content] │
│  ...                        │
│  ...                        │
│                             │
│  ┌───────────────────────┐  │
│  │  Watch on YouTube ▶   │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

- 從 Feed 卡片 Hero 動畫進入
- 支援手勢返回
- Markdown 渲染 summary

---

## ⚠️ 後端影響分析（重要）

> **核心原則**：手機 App 不應該影響 Web 用戶的體驗或穩定性。

| 後端模組 | 是否受影響 | 說明 |
|---------|-----------|------|
| **Python Worker** | ❌ 不影響 | App 只讀取資料，不觸發 Worker |
| **Database Schema** | ❌ 不影響 | 無需修改任何 table |
| **現有 API Routes** | ⚠️ 小改動 | 需支援 JWT auth（向下相容） |
| **NextAuth Session** | ❌ 不影響 | Web 繼續用 session cookie |

### 改動隔離策略

1. **新增檔案優先**：`auth/mobile/route.ts` 和 `auth-mobile.ts` 都是新增檔案
2. **現有 API 漸進式修改**：在現有 auth 邏輯之後加入 JWT fallback，不動原邏輯
3. **獨立測試**：Mobile API 可獨立測試，不需要動 Web 測試

---

## ✅ 驗收標準

### Phase 1: 專案設定與認證

- [ ] Flutter 專案可在 iOS Simulator 和 Android Emulator 執行
- [ ] Google Sign-In 流程正常（拿到 idToken）
- [ ] Mobile Auth API 可將 idToken 換成 JWT
- [ ] JWT 可成功呼叫 `/api/feed` 取得資料

### Phase 2: 核心功能

- [ ] Feed 列表可顯示文章，支援無限滾動
- [ ] 點擊文章 → 開啟閱讀器（Hero 動畫）
- [ ] 下拉刷新可載入新文章
- [ ] 訂閱管理可新增/刪除頻道

### Phase 3: UX 打磨

- [ ] 動畫流暢度達 60fps（使用 Flutter DevTools 驗證）
- [ ] 離線時可閱讀已快取文章
- [ ] 深色模式正確顯示

### Phase 4: 上架準備

- [ ] App icon 和 splash screen 設定完成
- [ ] iOS: 通過 TestFlight 審核
- [ ] Android: 通過 Internal Testing 審核

---

## 📋 實作前檢查清單

在開始實作前，確認以下項目：

- [ ] 安裝 Flutter SDK（建議 3.16+）
- [ ] 設定 iOS 開發環境（Xcode）
- [ ] 設定 Android 開發環境（Android Studio）
- [ ] 在 Google Cloud Console 設定 OAuth 2.0 Client ID（iOS + Android）
- [ ] 準備 `JWT_SECRET` 環境變數
- [ ] 確認 `GOOGLE_CLIENT_ID` 環境變數（現有 Web 用的）

---

## 📁 相關檔案快速導覽

| 類型 | 路徑 |
|------|------|
| **現有架構說明** | `documents/instruction_for_engineers/01_project_architecture.md` |
| **Backend GWT** | `documents/gwt/backend_worker.md` |
| **Frontend GWT** | `documents/gwt/frontend_subscription.md` |
| **Database Schema** | `prisma/schema.prisma` |
| **現有 Feed API** | `app/api/feed/route.ts` |
| **現有 Subscriptions API** | `app/api/subscriptions/route.ts` |
| **現有 Auth 設定** | `lib/auth.ts` |

---

## 📅 時程估計

| Phase | 內容 | 估計時間 |
|-------|------|---------|
| 1 | 專案設定 + Auth | 3 天 |
| 2 | 核心功能（Feed + Reader + Subs） | 5-7 天 |
| 3 | UX 打磨（動畫、離線、深色模式） | 3-4 天 |
| 4 | 上架準備 | 2-3 天 |

**總計**：約 **2-3 週** 可完成 MVP

---

## 💬 常見問題 FAQ

**Q: 為什麼不用 React Native？**
A: 經過評估，Flutter 在列表滾動和動畫流暢度上表現更好，更容易達到「Reeder 級」的體驗。

**Q: Mobile Auth API 會影響 Web 用戶嗎？**
A: 不會。這是一個全新的 API endpoint，Web 繼續使用 NextAuth session，完全獨立。

**Q: 為什麼用 Monorepo 而不是獨立 Repo？**
A: 因為開發模式是 AI 輔助（Vibe Coding），Monorepo 讓 AI 可以同時看到 Web 和 App 的程式碼，在後端 API 變動時更容易同步更新 App。

**Q: 如果後端 API 有變動怎麼辦？**
A: 因為是 Monorepo，修改 API 時可以同時搜尋 `mobile/` 目錄，確保 App 也有對應更新。

---

## 📞 技術聯絡

如有問題，請參考：
- `documents/instruction_for_engineers/01_project_architecture.md` - 系統架構總覽
- `documents/gwt/*.md` - 各模組行為規範
