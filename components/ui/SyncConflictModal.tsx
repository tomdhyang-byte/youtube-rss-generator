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
import { Button } from './Button';

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
                    <Button
                        variant="outline"
                        onClick={onDiscard}
                        fullWidth
                        className="sm:w-auto border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                    >
                        Discard Guest Data
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={onManage}
                        fullWidth
                        className="sm:w-auto"
                    >
                        Manage Subscriptions
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
