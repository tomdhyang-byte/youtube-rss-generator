import { isRetryableError, getErrorMessage } from '../singleEpisode';

describe('singleEpisode', () => {
    describe('isRetryableError', () => {
        it('returns true for API_ERROR', () => {
            expect(isRetryableError('API_ERROR')).toBe(true);
        });

        it('returns true for TRANSCRIPTION_ERROR', () => {
            expect(isRetryableError('TRANSCRIPTION_ERROR')).toBe(true);
        });

        it('returns true for SUMMARIZATION_ERROR', () => {
            expect(isRetryableError('SUMMARIZATION_ERROR')).toBe(true);
        });

        it('returns false for NO_TRANSCRIPT', () => {
            expect(isRetryableError('NO_TRANSCRIPT')).toBe(false);
        });

        it('returns false for AGE_RESTRICTED', () => {
            expect(isRetryableError('AGE_RESTRICTED')).toBe(false);
        });

        it('returns false for VIDEO_NOT_FOUND', () => {
            expect(isRetryableError('VIDEO_NOT_FOUND')).toBe(false);
        });

        it('returns false for VIDEO_TOO_LONG', () => {
            expect(isRetryableError('VIDEO_TOO_LONG')).toBe(false);
        });

        it('returns false for REGION_BLOCKED', () => {
            expect(isRetryableError('REGION_BLOCKED')).toBe(false);
        });

        it('returns false for null', () => {
            expect(isRetryableError(null)).toBe(false);
        });

        it('returns false for undefined', () => {
            expect(isRetryableError(undefined)).toBe(false);
        });
    });

    describe('getErrorMessage', () => {
        it('returns English message by default', () => {
            expect(getErrorMessage('NO_TRANSCRIPT')).toBe(
                'This video has no subtitles and cannot be summarized'
            );
        });

        it('returns English message for en locale', () => {
            expect(getErrorMessage('VIDEO_NOT_FOUND', 'en')).toBe(
                'This video does not exist or is private'
            );
        });

        it('returns Chinese message for zh-TW locale', () => {
            expect(getErrorMessage('NO_TRANSCRIPT', 'zh-TW')).toBe(
                '此影片沒有字幕，無法產生摘要'
            );
        });

        it('returns fallback message for unknown error code', () => {
            expect(getErrorMessage('UNKNOWN_ERROR')).toBe(
                'An error occurred, please try again later'
            );
        });

        it('returns fallback message for null', () => {
            expect(getErrorMessage(null)).toBe(
                'An error occurred, please try again later'
            );
        });
    });
});
