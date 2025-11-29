-- ============================================
-- 智能數據遷移腳本 (修復版)
-- 自動處理 ID 衝突，透過 youtube_id 重新建立關聯
-- ============================================

-- 步驟 1: 遷移 Channel 數據
-- 我們不遷移 'id'，而是讓 Postgres 自動生成新的 ID
-- 如果 youtube_id 已經存在，則跳過 (DO NOTHING)
INSERT INTO youtube_channels (youtube_id, title, description, rss_url, last_updated)
SELECT 
    youtube_id,
    title,
    description,
    rss_url,
    last_updated::timestamp
FROM "Channel"
ON CONFLICT (youtube_id) DO NOTHING;

-- 步驟 2: 遷移 Video 數據
-- 這是最關鍵的一步：我們需要找到舊影片對應的「新 Channel ID」
-- 我們透過 youtube_id 來連接舊表和新表
INSERT INTO youtube_videos (youtube_video_id, channel_id, title, summary, published_at)
SELECT 
    v.youtube_video_id,
    yc.id, -- 這裡取用 youtube_channels 表中實際存在的 ID
    v.title,
    v.summary,
    v.published_at::timestamp
FROM "Video" v
JOIN "Channel" c ON v.channel_id = c.id
JOIN youtube_channels yc ON c.youtube_id = yc.youtube_id -- 透過 youtube_id 重新對應
ON CONFLICT (youtube_video_id) DO NOTHING;

-- 步驟 3: 更新序列（Sequence）
-- 確保未來的插入不會有 ID 衝突
SELECT setval('youtube_channels_id_seq', (SELECT MAX(id) FROM youtube_channels), true);
SELECT setval('youtube_videos_id_seq', (SELECT MAX(id) FROM youtube_videos), true);

-- ============================================
-- 驗證遷移結果
-- ============================================

SELECT 
    (SELECT COUNT(*) FROM "Channel") as old_channel_count,
    (SELECT COUNT(*) FROM youtube_channels) as new_channel_count,
    (SELECT COUNT(*) FROM "Video") as old_video_count,
    (SELECT COUNT(*) FROM youtube_videos) as new_video_count;
