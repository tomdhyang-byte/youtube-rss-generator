const url = "https://podcasts.apple.com/tw/podcast/gooaye-%E8%82%A1%E7%99%8C/id1500839292?l=en-GB";

// Current Regex
const regex = /podcasts\.apple\.com\/[a-z]+\/podcast\/[a-z0-9-]+\/id(\d+)/;
const match = url.match(regex);

console.log("URL:", url);
console.log("Regex:", regex);
console.log("Match:", match);

if (match) {
    console.log("ID:", match[1]);
} else {
    console.log("FAILED to match ID");
}

// Proposed Regex (more permissive)
const proposedRegex = /podcasts\.apple\.com\/[a-z]+\/podcast\/.*\/id(\d+)/;
const proposedMatch = url.match(proposedRegex);
console.log("Proposed Regex:", proposedRegex);
console.log("Proposed Match:", proposedMatch);
