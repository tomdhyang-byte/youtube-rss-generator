# QA Master Checklist

---
### [ID: QC-001] Authentication
- **Action**: Click "Sign in with Google"
- **Expected Result**: Redirects to Google, returns to Dashboard logged in
- **Criticality**: High
- **Status**: ⚠️ Pending

---
### [ID: QC-002] Authentication
- **Action**: Click "Sign out"
- **Expected Result**: Returns to "Sign in to Continue" screen
- **Criticality**: High
- **Status**: ⚠️ Pending

---
### [ID: QC-003] YouTube
- **Action**: Input valid YouTube URL and click "Add Channel"
- **Expected Result**: Channel appears in list, Success toast appears
- **Criticality**: High
- **Status**: ⚠️ Pending

---
### [ID: QC-004] YouTube
- **Action**: Input invalid URL and click "Add Channel"
- **Expected Result**: Error toast appears, Channel NOT added
- **Criticality**: Medium
- **Status**: ⚠️ Pending

---
### [ID: QC-005] YouTube
- **Action**: Click "Trash" icon on a channel -> Confirm
- **Expected Result**: Channel removed from list, Success toast appears
- **Criticality**: High
- **Status**: ⚠️ Pending

---
### [ID: QC-006] YouTube
- **Action**: Click "RSS" icon on a channel
- **Expected Result**: RSS URL copied to clipboard
- **Criticality**: Medium
- **Status**: ⚠️ Pending

---
### [ID: QC-007] YouTube
- **Action**: Click "External Link" icon
- **Expected Result**: Opens YouTube channel in new tab
- **Criticality**: Low
- **Status**: ⚠️ Pending

---
### [ID: QC-008] Podcasts
- **Action**: Input valid Podcast RSS/Apple URL and click "Add Podcast"
- **Expected Result**: Podcast appears in list, Success toast appears
- **Criticality**: High
- **Status**: ⚠️ Pending

---
### [ID: QC-009] Podcasts
- **Action**: Click "Trash" icon on a podcast -> Confirm
- **Expected Result**: Podcast removed from list, Success toast appears
- **Criticality**: High
- **Status**: ⚠️ Pending

---
### [ID: QC-010] RSS Feed (YouTube)
- **Action**: Access `http://localhost:3000/feed/[id]` (YouTube)
- **Expected Result**: Valid XML RSS feed returned with episodes
- **Criticality**: High
- **Status**: ⚠️ Pending

---
### [ID: QC-011] RSS Feed (Podcast)
- **Action**: Access `http://localhost:3000/feed/podcast/[id]` (Podcast)
- **Expected Result**: Valid XML RSS feed returned with episodes
- **Criticality**: High
- **Status**: ⚠️ Pending

---
### [ID: QC-012] Quota
- **Action**: Add channel when quota is full (if applicable)
- **Expected Result**: "Add Channel" button disabled or Error toast
- **Criticality**: Medium
- **Status**: ⚠️ Pending

---
### [ID: QC-013] Theme
- **Action**: Click Theme Toggle in UserMenu dropdown
- **Expected Result**: Feature Removed (Dark Mode Enforced)
- **Criticality**: Low
- **Status**: ✅ Removed

---
### [ID: QC-014] Guest Mode
- **Action**: Visit site without signing in, add YouTube channel
- **Expected Result**: Channel appears in list with real name/description, "Sign in to save" toast
- **Criticality**: High
- **Status**: ⚠️ Pending

---
### [ID: QC-015] Guest Mode
- **Action**: As guest, try to add 2nd channel
- **Expected Result**: Login modal appears, cannot add without signing in
- **Criticality**: High
- **Status**: ⚠️ Pending

---
### [ID: QC-016] Login Wall
- **Action**: As guest, click "Copy RSS" button
- **Expected Result**: Login modal appears prompting sign-in
- **Criticality**: High
- **Status**: ⚠️ Pending

---
### [ID: QC-017] Silent Sync
- **Action**: As guest with 1 channel, sign in (account has space)
- **Expected Result**: Guest channel auto-syncs, localStorage cleared, success toast
- **Criticality**: High
- **Status**: ⚠️ Pending

---
### [ID: QC-018] Quota Conflict
- **Action**: As guest with 1 channel, sign in (account quota full)
- **Expected Result**: Conflict modal appears with "Discard" and "Manage" options
- **Criticality**: High
- **Status**: ⚠️ Pending

---
### [ID: QC-019] UserMenu
- **Action**: Click avatar/name in top-right corner
- **Expected Result**: Dropdown menu opens with Switch Account, Sign Out (Dark Mode removed)
- **Criticality**: Medium
- **Status**: ⚠️ Pending

---
### [ID: QC-020] Switch Account
- **Action**: Click "Switch Account" in UserMenu
- **Expected Result**: Redirects to Google sign-in page with account selector
- **Criticality**: Medium
- **Status**: ⚠️ Pending

---
### [ID: QC-021] RSS Empty State
- **Action**: Access RSS feed for newly added channel (no videos yet)
- **Expected Result**: RSS contains welcome message explaining processing time
- **Criticality**: Low
- **Status**: ⚠️ Pending

---
### [ID: QC-022] Guest Channel Info
- **Action**: As guest, add valid YouTube channel
- **Expected Result**: Real channel name and description displayed (not placeholder)
- **Criticality**: Medium
- **Status**: ⚠️ Pending

---
### [ID: QC-023] Podcast Metadata
- **Action**: Add Podcast with generic title, run worker
- **Expected Result**: Podcast title, description, and image update from RSS feed
- **Criticality**: Medium
- **Status**: ⚠️ Pending

---
### [ID: QC-024] Deepgram Transcription
- **Action**: Run worker with valid `DEEPGRAM_API_KEY`
- **Expected Result**: Podcast episodes are transcribed and summarized
- **Criticality**: High
- **Status**: ⚠️ Pending

---
### [ID: QC-025] Deepgram Missing Key
- **Action**: Run worker without `DEEPGRAM_API_KEY`
- **Expected Result**: Worker skips transcription gracefully, logs warning
- **Criticality**: Medium
- **Status**: ⚠️ Pending
