"use client";

import { Button } from "./Button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./dialog";

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: "danger" | "warning" | "info";
}

const confirmVariantMap = {
    danger: 'danger' as const,
    warning: 'primary' as const,
    info: 'secondary' as const,
};

export function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    onConfirm,
    onCancel,
    variant = "warning",
}: ConfirmDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onCancel}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-xl">{title}</DialogTitle>
                    <DialogDescription className="text-base pt-2">
                        {message}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 pt-4">
                    <Button
                        variant="outline"
                        onClick={onCancel}
                    >
                        {cancelText}
                    </Button>
                    <Button
                        variant={confirmVariantMap[variant]}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
