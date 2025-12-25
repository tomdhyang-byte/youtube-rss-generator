'use client';

import { Plus, Mic } from 'lucide-react';
import { AddChannelFormProps } from './types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/**
 * AddChannelForm Component
 * Reusable form for adding YouTube channels or Podcasts.
 */
export function AddChannelForm({
    type,
    value,
    onChange,
    onSubmit,
    loading,
    canAddMore,
    error
}: AddChannelFormProps) {
    const isYouTube = type === 'youtube';

    const placeholder = isYouTube
        ? "Paste YouTube Channel URL"
        : "Paste Apple Podcast Link or RSS URL";

    const buttonText = isYouTube ? "Add Channel" : "Add Podcast";
    const Icon = isYouTube ? Plus : Mic;

    return (
        <div className="mb-8">
            <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:gap-4 sm:items-start">
                <Input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    disabled={loading}
                    error={error}
                    inputSize="lg"
                    fullWidth
                    className="bg-secondary/50 border-input text-foreground placeholder:text-muted-foreground focus:bg-background"
                />
                <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={loading}
                    disabled={!canAddMore}
                    leftIcon={!loading ? <Icon className="w-5 h-5" /> : undefined}
                    className="w-full sm:w-auto h-12 whitespace-nowrap"
                    title={!canAddMore ? 'Quota reached - please unsubscribe from another to add' : ''}
                >
                    {buttonText}
                </Button>
            </form>
        </div>
    );
}
