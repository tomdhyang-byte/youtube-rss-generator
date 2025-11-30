'use client';

import { AlertTriangle } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface SyncConflictModalProps {
    isOpen: boolean;
    onDiscard: () => void;
    onManage: () => void;
}

export function SyncConflictModal({ isOpen, onDiscard, onManage }: SyncConflictModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={() => { }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                        </div>
                        <DialogTitle className="text-xl">Subscription Quota Reached</DialogTitle>
                    </div>
                    <DialogDescription className="text-base pt-3">
                        Your account is limited to 1 subscription. Please unsubscribe from existing channels to sync your guest data.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
                    <button
                        onClick={onDiscard}
                        className="w-full sm:w-auto px-6 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg font-medium hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                    >
                        Discard Guest Data
                    </button>
                    <button
                        onClick={onManage}
                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                        Manage Subscriptions
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
