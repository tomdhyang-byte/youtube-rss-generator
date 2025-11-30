'use client';

import { useEffect, useRef, useState } from 'react';
import { Session } from 'next-auth';
import { toast } from 'sonner';
import { GuestChannel } from '@/lib/types';

interface UseGuestSyncProps {
    session: Session | null;
    localChannels: GuestChannel[];
    onSyncComplete: () => void;
}

interface UseGuestSyncReturn {
    conflictModalOpen: boolean;
    setConflictModalOpen: (open: boolean) => void;
    handleDiscard: () => void;
}

export function useGuestSync({
    session,
    localChannels,
    onSyncComplete,
}: UseGuestSyncProps): UseGuestSyncReturn {
    const [conflictModalOpen, setConflictModalOpen] = useState(false);
    const isSyncing = useRef(false);
    const hasSynced = useRef(false);

    const handleDiscard = () => {
        console.log('[useGuestSync] User discarded guest data');
        // Clear localStorage
        localStorage.removeItem('guest_channels');
        // Mark as synced to prevent re-sync
        hasSynced.current = true;
        // Reset sync lock
        isSyncing.current = false;
        // Close modal
        setConflictModalOpen(false);
    };

    useEffect(() => {
        // Only sync if:
        // 1. User is authenticated
        // 2. There are local channels to sync
        // 3. Not currently syncing
        // 4. Haven't already synced in this session
        if (!session || localChannels.length === 0 || isSyncing.current || hasSynced.current) {
            return;
        }

        // 🚀 OPTIMISTIC UPDATE: Immediately trigger UI update with guest data
        console.log(`[useGuestSync] Optimistic update - showing ${localChannels.length} guest channels immediately`);
        onSyncComplete(); // This will trigger fetchSubscriptions, which will show guest channels momentarily

        const syncGuestChannelsInBackground = async () => {
            isSyncing.current = true;
            console.log(`[useGuestSync] Starting background sync of ${localChannels.length} guest channels...`);

            let successCount = 0;
            let skipCount = 0;
            let quotaFull = false;

            for (const channel of localChannels) {
                try {
                    const res = await fetch('/api/channels', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            url: channel.url,
                            metadata: channel.cached_metadata, // ✨ Use cached metadata
                        }),
                    });

                    if (res.ok) {
                        successCount++;
                        console.log(`[useGuestSync] ✓ Synced: ${channel.title}`);
                    } else if (res.status === 409) {
                        // Already exists - treat as success
                        skipCount++;
                        console.log(`[useGuestSync] ⊘ Already exists: ${channel.title}`);
                    } else if (res.status === 403) {
                        // Quota reached
                        quotaFull = true;
                        console.log(`[useGuestSync] ⚠ Quota full, stopping sync`);
                        break;
                    } else {
                        const data = await res.json().catch(() => ({}));
                        console.error(`[useGuestSync] ✗ Failed to sync ${channel.title}:`, data.error);
                    }
                } catch (error) {
                    console.error(`[useGuestSync] ✗ Error syncing ${channel.title}:`, error);
                }
            }

            if (quotaFull) {
                // Show conflict modal but don't reset lock yet
                // Lock will be reset when user chooses an action
                setConflictModalOpen(true);
                // Mark as synced to prevent re-triggering
                hasSynced.current = true;
            } else {
                // Clear localStorage and refresh
                localStorage.removeItem('guest_channels');
                hasSynced.current = true;
                isSyncing.current = false;

                if (successCount > 0 || skipCount > 0) {
                    toast.success(
                        `Successfully synced ${successCount + skipCount} channel${successCount + skipCount > 1 ? 's' : ''}!`
                    );
                }

                // Silent revalidation after a short delay
                setTimeout(() => {
                    console.log('[useGuestSync] Silent revalidation - fetching real data from server');
                    onSyncComplete();
                }, 1500);
            }
        };

        // Start background sync
        syncGuestChannelsInBackground();
    }, [session, localChannels, onSyncComplete]);

    return {
        conflictModalOpen,
        setConflictModalOpen,
        handleDiscard,
    };
}
