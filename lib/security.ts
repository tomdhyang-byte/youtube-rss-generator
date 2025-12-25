
/**
 * Security utilities for validating user-supplied URLs to prevent SSRF and other attacks.
 */

// Allowlist for YouTube domains
const YOUTUBE_DOMAINS = [
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtu.be',
    'www.youtu.be'
];

/**
 * Validates if a URL is a valid and safe YouTube URL.
 * Only allows specific domains to prevent SSRF redirection attacks.
 */
export function isValidYoutubeUrl(url: string): boolean {
    if (!url) return false;

    try {
        const parsedUrl = new URL(url);
        return YOUTUBE_DOMAINS.includes(parsedUrl.hostname);
    } catch (e) {
        return false;
    }
}

/**
 * Validates if a Podcast RSS URL is safe to fetch.
 * Blocks private IP ranges (IPv4) and localhost to prevent internal network scanning.
 * 
 * Blocked ranges:
 * - 0.0.0.0/8
 * - 10.0.0.0/8
 * - 127.0.0.0/8
 * - 169.254.0.0/16
 * - 172.16.0.0/12
 * - 192.168.0.0/16
 * - ::1 (IPv6 localhost)
 */
export function isSafePodcastUrl(url: string): boolean {
    if (!url) return false;

    try {
        const parsedUrl = new URL(url);

        // Only allow http/https
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return false;
        }

        const hostname = parsedUrl.hostname;

        // Block localhost
        if (hostname === 'localhost') return false;

        // Block IPv4 Private Ranges
        // Basic regex for spotting IP addresses (not perfect but covers obvious cases)
        const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
        const match = hostname.match(ipv4Regex);

        if (match) {
            const parts = match.slice(1).map(Number);
            const [p1, p2] = parts;

            // 0.0.0.0/8
            if (p1 === 0) return false;
            // 10.0.0.0/8
            if (p1 === 10) return false;
            // 127.0.0.0/8
            if (p1 === 127) return false;
            // 169.254.0.0/16
            if (p1 === 169 && p2 === 254) return false;
            // 172.16.0.0/12 (172.16 - 172.31)
            if (p1 === 172 && p2 >= 16 && p2 <= 31) return false;
            // 192.168.0.0/16
            if (p1 === 192 && p2 === 168) return false;
        }

        // IPv6 check (basic)
        if (hostname === '::1' || hostname === '[::1]') return false;

        return true;

    } catch (e) {
        return false;
    }
}
