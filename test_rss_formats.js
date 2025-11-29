// Test different RSS image formats
const RSS = require('rss');

const feed = new RSS({
    title: '美股咖啡館 (AI Summarized)',
    description: 'Test feed with avatar',
    feed_url: 'http://localhost:3000/feed/2',
    site_url: 'https://www.youtube.com/channel/UCjrP2TtSTifuRJ76hW2IW1A',
    image_url: 'https://yt3.googleusercontent.com/ie4Gm5EhlavXq6NPSmYq833D6Y1M9ZMgH1BBHPZglobnzG5FvT_v16Inv-svDdeigBfvAvTQ=s900-c-k-c0x00ffffff-no-rj',
    language: 'en',
    custom_namespaces: {
        'itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd',
        'atom': 'http://www.w3.org/2005/Atom'
    },
    custom_elements: [
        { 'itunes:image': { _attr: { href: 'https://yt3.googleusercontent.com/ie4Gm5EhlavXq6NPSmYq833D6Y1M9ZMgH1BBHPZglobnzG5FvT_v16Inv-svDdeigBfvAvTQ=s900-c-k-c0x00ffffff-no-rj' } } },
    ]
});

feed.item({
    title: 'Test Video',
    description: 'Test description',
    url: 'https://www.youtube.com/watch?v=test',
    date: new Date(),
});

const xml = feed.xml({ indent: true });
console.log(xml);
