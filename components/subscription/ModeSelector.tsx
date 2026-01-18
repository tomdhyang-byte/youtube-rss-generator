'use client';

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type SubscriptionMode = 'youtube_channel' | 'podcast_channel' | 'single_episode';

interface ModeSelectorProps {
    value: SubscriptionMode;
    onChange: (mode: SubscriptionMode) => void;
    disabled?: boolean;
}

export function ModeSelector({ value, onChange, disabled }: ModeSelectorProps) {
    const t = useTranslations('Subscriptions');

    const modes: { value: SubscriptionMode; label: string; isNew?: boolean }[] = [
        { value: 'youtube_channel', label: t('mode_youtube_channel') },
        { value: 'podcast_channel', label: t('mode_podcast_channel') },
        { value: 'single_episode', label: t('mode_single_episode'), isNew: true },
    ];

    return (
        <div className="relative">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value as SubscriptionMode)}
                disabled={disabled}
                className="
                    appearance-none
                    bg-secondary/50
                    border border-input
                    rounded-lg
                    px-4 pr-10 py-3
                    text-sm font-medium
                    text-foreground
                    cursor-pointer
                    focus:outline-none
                    focus:ring-2
                    focus:ring-primary/50
                    focus:border-primary
                    disabled:opacity-50
                    disabled:cursor-not-allowed
                    min-w-[200px]
                "
            >
                {modes.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                        {mode.label} {mode.isNew ? '✨' : ''}
                    </option>
                ))}
            </select>
            <ChevronDown
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            />
        </div>
    );
}
