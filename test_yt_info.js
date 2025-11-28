const ytChannelInfo = require('yt-channel-info');

async function test() {
    console.log("Testing yt-channel-info...");
    const channelId = 'UC_x5XG1OV2P6uZZ5FSM9Ttw'; // Google Developers

    try {
        console.log("Fetching valid channel...");
        const info = await ytChannelInfo.getChannelInfo({ channelId });
        console.log("Success:", info.author);
    } catch (e) {
        console.error("Error fetching valid channel:", e);
    }

    try {
        console.log("Fetching INVALID channel...");
        // Use a fake ID that looks real but isn't
        await ytChannelInfo.getChannelInfo({ channelId: 'UC_INVALID_ID_1234567890' });
    } catch (e) {
        console.log("Caught expected error:", e.message);
    }
}

test();
