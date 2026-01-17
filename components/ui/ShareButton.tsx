'use client';

import { Share2, Check, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { IconButton } from './IconButton';

interface ShareButtonProps {
    url: string;
    className?: string;
}

type CopyState = 'idle' | 'copied' | 'failed';

export function ShareButton({ url, className }: ShareButtonProps) {
    const t = useTranslations('Share');
    const [copyState, setCopyState] = useState<CopyState>('idle');

    const handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering card click

        const fullUrl = `${window.location.origin}${url}`;

        try {
            await navigator.clipboard.writeText(fullUrl);
            setCopyState('copied');
            toast.success(t('toast_success'));
        } catch {
            // Fallback for older browsers or restricted contexts
            try {
                const textArea = document.createElement('textarea');
                textArea.value = fullUrl;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                setCopyState('copied');
                toast.success(t('toast_success'));
            } catch {
                setCopyState('failed');
                toast.error(t('toast_failed'));
            }
        }

        setTimeout(() => setCopyState('idle'), 2000);
    };

    const icon = {
        idle: <Share2 className="w-5 h-5" />,
        copied: <Check className="w-5 h-5 text-green-500" />,
        failed: <X className="w-5 h-5 text-red-500" />,
    }[copyState];

    const label = {
        idle: t('copy_link'),
        copied: t('copied'),
        failed: t('copy_failed'),
    }[copyState];

    return (
        <IconButton
            variant="default"
            aria-label={label}
            title={label}
            onClick={handleShare}
            className={className}
        >
            {icon}
        </IconButton>
    );
}
