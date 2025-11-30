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
### [ID: QC-010] RSS Feed
- **Action**: Access `http://localhost:3000/feed/[id]` (YouTube)
- **Expected Result**: Valid XML RSS feed returned with episodes
- **Criticality**: High
- **Status**: ⚠️ Pending

---
### [ID: QC-011] RSS Feed
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
- **Action**: Click Theme Toggle
- **Expected Result**: UI switches between Light/Dark mode
- **Criticality**: Low
- **Status**: ⚠️ Pending
