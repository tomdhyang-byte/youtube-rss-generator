import { NextResponse } from 'next/server';

/**
 * Test RSS Feed for styling experiments
 * Access at: /api/test-feed
 * 
 * This feed contains sample items with different blockquote styling
 * to test how they render in various RSS readers.
 */
export async function GET() {
    const now = new Date().toUTCString();

    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
    <title>TubeSummary - Style Test Feed</title>
    <link>https://youtube-rss-generator.vercel.app</link>
    <description>Testing different blockquote styles in RSS readers</description>
    <lastBuildDate>${now}</lastBuildDate>
    
    <item>
        <title>Style A: 無樣式 Blockquote (Default)</title>
        <link>https://youtube-rss-generator.vercel.app/test/1</link>
        <guid isPermaLink="false">test-style-a</guid>
        <pubDate>${now}</pubDate>
        <description><![CDATA[
<h3>🔥 測試金句 - 無 inline style</h3>

<blockquote>
"AI 不會取代你，但使用 AI 的人會取代你。"
<br>— <b>這是對 AI 時代的經典警告</b>
</blockquote>

<blockquote>
"最好的投資是投資自己。"
<br>— <b>巴菲特的經典名言</b>
</blockquote>

<p>這是預設的 blockquote，沒有任何 inline style，完全依賴 RSS Reader 的預設渲染。</p>
        ]]></description>
    </item>
    
    <item>
        <title>Style B: 橘色左邊框 + 淡黃背景</title>
        <link>https://youtube-rss-generator.vercel.app/test/2</link>
        <guid isPermaLink="false">test-style-b</guid>
        <pubDate>${now}</pubDate>
        <description><![CDATA[
<h3>🔥 測試金句 - 橘色邊框風格</h3>

<blockquote style="border-left: 4px solid #f59e0b; padding-left: 16px; margin: 16px 0; background: #fffbeb; padding: 12px 16px;">
"AI 不會取代你，但使用 AI 的人會取代你。"
<br>— <b>這是對 AI 時代的經典警告</b>
</blockquote>

<blockquote style="border-left: 4px solid #f59e0b; padding-left: 16px; margin: 16px 0; background: #fffbeb; padding: 12px 16px;">
"最好的投資是投資自己。"
<br>— <b>巴菲特的經典名言</b>
</blockquote>

<p>這個風格使用橘色左邊框 (#f59e0b) 配淡黃色背景 (#fffbeb)。</p>
        ]]></description>
    </item>
    
    <item>
        <title>Style C: 藍色左邊框 + 灰色背景</title>
        <link>https://youtube-rss-generator.vercel.app/test/3</link>
        <guid isPermaLink="false">test-style-c</guid>
        <pubDate>${now}</pubDate>
        <description><![CDATA[
<h3>🔥 測試金句 - 藍色邊框風格</h3>

<blockquote style="border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; background: #f0f9ff;">
"AI 不會取代你，但使用 AI 的人會取代你。"
<br>— <b>這是對 AI 時代的經典警告</b>
</blockquote>

<blockquote style="border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; background: #f0f9ff;">
"最好的投資是投資自己。"
<br>— <b>巴菲特的經典名言</b>
</blockquote>

<p>這個風格使用藍色左邊框 (#3b82f6) 配淡藍色背景 (#f0f9ff)。</p>
        ]]></description>
    </item>
    
    <item>
        <title>Style D: 深色模式友善 (透明背景)</title>
        <link>https://youtube-rss-generator.vercel.app/test/4</link>
        <guid isPermaLink="false">test-style-d</guid>
        <pubDate>${now}</pubDate>
        <description><![CDATA[
<h3>🔥 測試金句 - 深色模式友善</h3>

<blockquote style="border-left: 4px solid #f59e0b; padding-left: 16px; margin: 16px 0; font-style: italic;">
"AI 不會取代你，但使用 AI 的人會取代你。"
<br><span style="font-style: normal;">— <b>這是對 AI 時代的經典警告</b></span>
</blockquote>

<blockquote style="border-left: 4px solid #f59e0b; padding-left: 16px; margin: 16px 0; font-style: italic;">
"最好的投資是投資自己。"
<br><span style="font-style: normal;">— <b>巴菲特的經典名言</b></span>
</blockquote>

<p>這個風格只用橘色左邊框 + 斜體，不設背景色，對深/淺色模式都友善。</p>
        ]]></description>
    </item>

</channel>
</rss>`;

    return new Response(rssXml, {
        headers: {
            'Content-Type': 'application/rss+xml; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
    });
}
