# PRD: Optimistic Channel Subscription Optimization

## 1. Context & Problem Statement

**Current Status:**
Adding a YouTube channel or Podcast involves synchronous backend operations (fetching 3rd party APIs) that block the response.
- **YouTube:** Fetches channel page (~1-2s) + metadata (~1s).
- **Podcast:** iTunes lookup (~1s) + RSS parse (~1-2s).
- **Result:** Users wait 2-6 seconds after pasting a URL before seeing any feedback. This is a poor user experience.

**Goal:**
Improve the "Time to Feedback" to **< 300ms** by implementing an Optimistic UI pattern supported by an asynchronous backend architecture.

---

## 2. User Experience (UX)

### 2.1 The "Happy" Path
1.  **User Action:** User pastes a URL (e.g., `youtube.com/@MKBHD`) and clicks "Subscribe".
2.  **Immediate Feedback (< 300ms):**
    -   API validates URL format only and returns immediately using a `pendingUrl`.
    -   UI shows a "New Channel" card with a loading spinner/skeleton state.
    -   Status text: "Adding channel..." or "Resolving metadata...".
3.  **Background Processing (3-10s):**
    -   Worker resolves the ID, fetches Title/Description/Avatar.
    -   Frontend polls for status updates (or re-fetches on interval).
4.  **Completion:**
    -   Card automatically updates to show the real Channel Name, Description, and Thumbnail.
    -   User can interactions (View RSS, Change Style) immediately, though content might populate gradually.

### 2.2 The "Error" Path
1.  **Worker Failure:** If the URL is invalid or the channel doesn't exist (after backend parsing).
2.  **UI Feedback:**
    -   Card state changes to **Error**.
    -   Visual cue: Red border or error badge.
    -   Action: "Remove" button only (no retry for now to keep it simple, or optional retry).
    -   Message: "Failed to resolve channel."

---

## 3. Technical Architecture

### 3.1 Backend API (Asynchronous)

Refactor `POST /api/channels` and `POST /api/podcasts` to be non-blocking.

*   **Logic:**
    1.  **Fast Validation:** Check regex/URL format.
    2.  **Try Fast Resolve (Optional):** If URL contains the ID (e.g., `/channel/UC...`), extract it directly.
    3.  **Fallback to Pending:** If ID is missing (e.g., `@handle`), store the raw URL in `pendingUrl` and set status to `PENDING`.
    4.  **Immediate Return:** Return the (potentially incomplete) subscription object to the client.

### 3.2 Database Schema Schema (Prisma)

Update `YoutubeChannel` and `PodcastChannel` models to support state tracking.

```prisma
enum ChannelStatus {
  PENDING   // Waiting for Worker
  READY     // Fully resolved
  FAILED    // Resolution failed
}

model YoutubeChannel {
  id           Int           @id @default(autoincrement())
  status       ChannelStatus @default(READY)
  pendingUrl   String?       // Stores raw URL while PENDING
  youtube_id   String?       @unique // Changed from String to String? (nullable)
  // ... other fields
}
// Same structure for PodcastChannel
```

### 3.3 Worker Logic (Python)

Enhance `worker/youtube.py` and `worker/podcast.py`:
1.  **Identify PENDING:** Select channels where `status = 'PENDING'`.
2.  **Resolve:**
    -   Use `pendingUrl` to fetch the real ID.
    -   **YouTube:** Use `services/youtube_metadata.py` (contains `fetch_videos_from_rss`, `fetch_videos_from_scrapetube`).
    -   **Podcast:** Use iTunes/RSS lookup.
    -   Fetch Metadata (Title, Desc).
3.  **Update:**
    -   **Success:** Update `youtube_id`, `title`, `description`, set `status = 'READY'`, clear `pendingUrl`.
    -   **Failure:** Set `status = 'FAILED'`.

> **Note (2026-01-18):** YouTube metadata fetching logic has been refactored into `backend/services/youtube_metadata.py`. The `worker/youtube.py` now handles orchestration only (~200 lines). Import metadata functions from the services layer.

### 3.4 Frontend Logic

*   **Polling:** Update `useSubscriptions` (React Query) to poll (`refetchInterval`) every 3-5s if any subscription in the list has `status === 'PENDING'`.
*   **Component:** Update `SubscriptionCard` to handle `PENDING` (loading state) and `FAILED` (error state) props.

---

## 4. Implementation Steps

### Phase 1: Database & Worker (Backend Prep)
1.  Modify Prisma Schema: Add `status` and `pendingUrl`, make IDs nullable.
2.  Create Migration.
3.  Update Worker to handle `PENDING` resolution logic.
    *   *Note: Can be deployed safely before API changes.*

### Phase 2: API & Frontend (The Switch)
1.  Update API Routes to stop blocking and save as `PENDING`.
2.  Update Frontend `useSubscriptions` to poll when pending items exist.
3.  Update UI Components (`SubscriptionCard`) to reflect states.

---

## 5. Deployment Strategy (Risk Mitigation)

**Worker Dependency:**
Since the API will rely on the Worker to "finish" the subscription creation, **Worker code must be deployed/updated EITHER before OR simultaneously** with the API change.

*   **Option A (Recommended):** Deploy Worker changes first. It will simply ignore PENDING rows (since API isn't creating them yet). Then deploy API/Frontend.
*   **Option B:** Simultaneous deployment.

**Fail-safe:**
If Worker is down, cards will remain in "Adding..." state. API should act as a "pass-through" for standard URLs (`/channel/ID`) to minimize dependency on Worker for the easy cases.
