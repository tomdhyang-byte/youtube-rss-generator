'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'tubereader_read_items';

/**
 * Hook to manage read/unread status using localStorage
 * Stores item IDs in the format: "video-{id}" or "episode-{id}"
 */
export function useReadStatus() {
    const [readItems, setReadItems] = useState<Set<string>>(new Set());
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as string[];
                setReadItems(new Set(parsed));
            }
        } catch (error) {
            console.error('Failed to load read status:', error);
        }
        setIsLoaded(true);
    }, []);

    // Save to localStorage whenever readItems changes
    useEffect(() => {
        if (isLoaded) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify([...readItems]));
            } catch (error) {
                console.error('Failed to save read status:', error);
            }
        }
    }, [readItems, isLoaded]);

    const markAsRead = useCallback((type: 'video' | 'episode', id: string) => {
        const key = `${type}-${id}`;
        setReadItems(prev => {
            const next = new Set(prev);
            next.add(key);
            return next;
        });
    }, []);

    const isRead = useCallback((type: 'video' | 'episode', id: string) => {
        const key = `${type}-${id}`;
        return readItems.has(key);
    }, [readItems]);

    const clearAll = useCallback(() => {
        setReadItems(new Set());
    }, []);

    return {
        isRead,
        markAsRead,
        clearAll,
        isLoaded,
    };
}
