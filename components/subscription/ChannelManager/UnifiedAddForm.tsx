'use client';

import { useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ModeSelector, SubscriptionMode } from '../ModeSelector';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StyleSelector, SummaryStyle } from '@/components/ui/StyleSelector';
import { LanguageSelector, SummaryLanguage } from '@/components/ui/LanguageSelector';
import { useSubmitSingleEpisodeMutation } from '@/hooks/useSingleEpisodes';
import { LoginModal } from '@/components/auth/LoginModal';

interface UnifiedAddFormProps {
    onYouTubeSubmit: (url: string) => Promise<void>;
    onPodcastSubmit: (url: string) => Promise<void>;
    loading: boolean;
    canAddMore: boolean;
    error: string;
}

// LocalStorage key for pending single episode (guest mode)
const PENDING_SINGLE_EPISODE = 'pending_single_episode';

/**
 * UnifiedAddForm Component
 * A unified search bar with mode selector for adding YouTube channels,
 * Podcast channels, or single episodes.
 */
export function UnifiedAddForm({
    onYouTubeSubmit,
    onPodcastSubmit,
    loading: externalLoading,
    canAddMore,
    error: externalError,
}: UnifiedAddFormProps) {
    const t = useTranslations('Subscriptions');
    const { data: session } = useSession();

    // Form state
    const [mode, setMode] = useState<SubscriptionMode>('youtube_channel');
    const [url, setUrl] = useState('');
    const [singleEpisodeStyle, setSingleEpisodeStyle] = useState<SummaryStyle>('DEFAULT');
    const [singleEpisodeLanguage, setSingleEpisodeLanguage] = useState<SummaryLanguage>('ZH_TW');
    const [localError, setLocalError] = useState('');
    const [loginModalOpen, setLoginModalOpen] = useState(false);

    // Single episode mutation
    const submitSingleEpisode = useSubmitSingleEpisodeMutation();

    const loading = externalLoading || submitSingleEpisode.isPending;
    const error = localError || externalError;

    // Get placeholder text based on mode
    const getPlaceholder = () => {
        switch (mode) {
            case 'youtube_channel':
                return t('add_youtube_placeholder');
            case 'podcast_channel':
                return t('add_podcast_placeholder');
            case 'single_episode':
                return t('add_single_placeholder');
        }
    };

    // Get button text based on mode
    const getButtonText = () => {
        switch (mode) {
            case 'youtube_channel':
                return t('add_channel_btn');
            case 'podcast_channel':
                return t('add_podcast_btn');
            case 'single_episode':
                return t('add_single_btn');
        }
    };

    // Get button icon based on mode
    const ButtonIcon = mode === 'single_episode' ? Sparkles : Plus;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url.trim()) {
            toast.error(getPlaceholder());
            return;
        }

        setLocalError('');

        switch (mode) {
            case 'youtube_channel':
                await onYouTubeSubmit(url);
                setUrl('');
                break;

            case 'podcast_channel':
                await onPodcastSubmit(url);
                setUrl('');
                break;

            case 'single_episode':
                // Guest mode: Save to localStorage and prompt login
                if (!session) {
                    localStorage.setItem(PENDING_SINGLE_EPISODE, JSON.stringify({
                        url,
                        style: singleEpisodeStyle,
                        language: singleEpisodeLanguage,
                    }));
                    setLoginModalOpen(true);
                    return;
                }

                // Authenticated mode: Submit single episode
                submitSingleEpisode.mutate(
                    {
                        url,
                        style: singleEpisodeStyle,
                        language: singleEpisodeLanguage,
                    },
                    {
                        onSuccess: (data) => {
                            if (data.status === 'ready') {
                                toast.success(t('single_episode_ready'));
                            } else {
                                toast.success(t('single_episode_added_success'));
                            }
                            setUrl('');
                        },
                        onError: (err) => {
                            setLocalError(err.message);
                            toast.error(err.message);
                        },
                    }
                );
                break;
        }
    };

    return (
        <>
            <LoginModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} />

            <div className="mb-8">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Main input row: Mode selector + URL input + Submit button */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:gap-2 sm:items-start">
                        <ModeSelector
                            value={mode}
                            onChange={setMode}
                            disabled={loading}
                        />

                        <div className="flex-1 flex flex-col sm:flex-row gap-2">
                            <Input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder={getPlaceholder()}
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
                                disabled={mode !== 'single_episode' && !canAddMore}
                                leftIcon={!loading ? <ButtonIcon className="w-5 h-5" /> : undefined}
                                className="w-full sm:w-auto h-12 whitespace-nowrap"
                                title={!canAddMore && mode !== 'single_episode' ? t('quota_reached') : ''}
                            >
                                {getButtonText()}
                            </Button>
                        </div>
                    </div>

                    {/* Single episode options: Style and Language selectors */}
                    {mode === 'single_episode' && (
                        <div className="flex flex-wrap gap-4 items-center pl-0 sm:pl-[218px]">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">{t('style_label')}:</span>
                                <StyleSelector
                                    value={singleEpisodeStyle}
                                    onChange={setSingleEpisodeStyle}
                                    disabled={loading}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <LanguageSelector
                                    value={singleEpisodeLanguage}
                                    onChange={setSingleEpisodeLanguage}
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </>
    );
}
