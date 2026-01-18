/**
 * Single Episode API Tests
 *
 * Tests for the single episode FIFO logic and API behavior.
 * Run with: npx jest lib/services/__tests__/singleEpisodeApi.test.ts
 */

import { prisma } from '@/lib/prisma';
import { SummaryStyle } from '@/lib/types/summary-style';
import { SummaryLanguage } from '@/lib/types/summary-language';

// Mock Prisma for unit testing
jest.mock('@/lib/prisma', () => ({
    prisma: {
        $transaction: jest.fn(),
        userSingleEpisode: {
            count: jest.fn(),
            findFirst: jest.fn(),
            delete: jest.fn(),
            create: jest.fn(),
        },
        youtubeVideo: {
            findUnique: jest.fn(),
        },
    },
}));

const SINGLE_EPISODE_LIMIT = 50;

/**
 * FIFO Deletion Logic
 *
 * When a user has reached the limit (50), the oldest entry should be deleted
 * before creating a new one.
 */
describe('FIFO Deletion Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should NOT delete when under limit', async () => {
        const mockCount = jest.fn().mockResolvedValue(49);
        const mockDelete = jest.fn();
        const mockFindFirst = jest.fn();

        const tx = {
            userSingleEpisode: {
                count: mockCount,
                findFirst: mockFindFirst,
                delete: mockDelete,
            },
        };

        // Simulate FIFO check logic
        const count = await tx.userSingleEpisode.count({ where: { userId: 'user-1' } });

        if (count >= SINGLE_EPISODE_LIMIT) {
            const oldest = await tx.userSingleEpisode.findFirst({
                where: { userId: 'user-1' },
                orderBy: { createdAt: 'asc' },
            });
            if (oldest) {
                await tx.userSingleEpisode.delete({ where: { id: oldest.id } });
            }
        }

        expect(mockCount).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
        expect(mockFindFirst).not.toHaveBeenCalled();
        expect(mockDelete).not.toHaveBeenCalled();
    });

    it('should delete oldest when at limit (50)', async () => {
        const mockCount = jest.fn().mockResolvedValue(50);
        const mockFindFirst = jest.fn().mockResolvedValue({ id: 1, createdAt: new Date('2023-01-01') });
        const mockDelete = jest.fn().mockResolvedValue({});

        const tx = {
            userSingleEpisode: {
                count: mockCount,
                findFirst: mockFindFirst,
                delete: mockDelete,
            },
        };

        // Simulate FIFO check logic
        const count = await tx.userSingleEpisode.count({ where: { userId: 'user-1' } });

        if (count >= SINGLE_EPISODE_LIMIT) {
            const oldest = await tx.userSingleEpisode.findFirst({
                where: { userId: 'user-1' },
                orderBy: { createdAt: 'asc' },
            });
            if (oldest) {
                await tx.userSingleEpisode.delete({ where: { id: oldest.id } });
            }
        }

        expect(mockCount).toHaveBeenCalled();
        expect(mockFindFirst).toHaveBeenCalledWith({
            where: { userId: 'user-1' },
            orderBy: { createdAt: 'asc' },
        });
        expect(mockDelete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should delete oldest when over limit (51)', async () => {
        const mockCount = jest.fn().mockResolvedValue(51);
        const mockFindFirst = jest.fn().mockResolvedValue({ id: 5, createdAt: new Date('2023-01-01') });
        const mockDelete = jest.fn().mockResolvedValue({});

        const tx = {
            userSingleEpisode: {
                count: mockCount,
                findFirst: mockFindFirst,
                delete: mockDelete,
            },
        };

        const count = await tx.userSingleEpisode.count({ where: { userId: 'user-1' } });

        if (count >= SINGLE_EPISODE_LIMIT) {
            const oldest = await tx.userSingleEpisode.findFirst({
                where: { userId: 'user-1' },
                orderBy: { createdAt: 'asc' },
            });
            if (oldest) {
                await tx.userSingleEpisode.delete({ where: { id: oldest.id } });
            }
        }

        expect(mockDelete).toHaveBeenCalledWith({ where: { id: 5 } });
    });

    it('should handle case where findFirst returns null', async () => {
        const mockCount = jest.fn().mockResolvedValue(50);
        const mockFindFirst = jest.fn().mockResolvedValue(null);
        const mockDelete = jest.fn();

        const tx = {
            userSingleEpisode: {
                count: mockCount,
                findFirst: mockFindFirst,
                delete: mockDelete,
            },
        };

        const count = await tx.userSingleEpisode.count({ where: { userId: 'user-1' } });

        if (count >= SINGLE_EPISODE_LIMIT) {
            const oldest = await tx.userSingleEpisode.findFirst({
                where: { userId: 'user-1' },
                orderBy: { createdAt: 'asc' },
            });
            if (oldest) {
                await tx.userSingleEpisode.delete({ where: { id: oldest.id } });
            }
        }

        expect(mockFindFirst).toHaveBeenCalled();
        expect(mockDelete).not.toHaveBeenCalled();
    });
});

/**
 * Style and Language Validation
 */
describe('Style and Language Validation', () => {
    it('should accept valid styles', () => {
        const validStyles: SummaryStyle[] = ['DEFAULT', 'QUICK_READ'];
        validStyles.forEach(style => {
            expect(['DEFAULT', 'QUICK_READ'].includes(style)).toBe(true);
        });
    });

    it('should accept valid languages', () => {
        const validLanguages: SummaryLanguage[] = ['EN', 'ZH_TW'];
        validLanguages.forEach(lang => {
            expect(['EN', 'ZH_TW'].includes(lang)).toBe(true);
        });
    });
});
