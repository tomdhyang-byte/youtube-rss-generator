# 🧠 Lessons Learned (The "Graveyard" of Past Mistakes)

A collection of issues we've faced and how to avoid them. **Check this before major refactors.**

## General
*   **Timeouts**: Vercel Serverless Functions have a 10s (standard) or 60s (pro) timeout. Long-running tasks (like fetching 50 videos) MUST proceed via the Background Worker (`backend/worker`), not in a blocking API call.
*   **SSRF**: Always validate user-provided URLs using `lib/security.ts` before making HTTP requests.

## Frontend
*   **Optimistic UI**: We use `react-query`'s `onMutate`. When debugging "flickering" UI (data appears then disappears), check if `onMutate` is correctly updating the cache and if the subsequent `onError` rollback is triggering falsely.
*   **i18n**: All user-facing text must be in `messages/*.json`. Do not hardcode strings in components.

## Worker & AI
*   **Prompt Engineering**:
    *   **Issue**: Modifying prompts in `summarize.py` can break JSON parsing if the AI becomes too "chatty".
    *   **Fix**: Always enforce strict output formats (e.g. "Result must be valid Markdown") and test with a few videos after prompt changes.
*   **YouTube Rate Limits**:
    *   **Issue**: `youtube-transcript-api` can be IP-banned if called too aggressively.
    *   **Fix**: The worker has a built-in cooldown logic. Do not remove the `sleep` calls in the worker loops.
