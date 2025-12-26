'use client';

import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoginModal } from "@/components/auth/LoginModal";

// Import sub-components
import { AddChannelForm } from './AddChannelForm';
import { SubscriptionCard } from './SubscriptionCard';
import { ChannelManagerProps } from './types';
import { useChannelManager } from './useChannelManager';

/**
 * ChannelManager Component
 * Main component for managing YouTube channel and Podcast subscriptions.
 * Refactored to use useChannelManager hook for logic.
 */
export default function ChannelManager(props: ChannelManagerProps) {
    const t = useTranslations('Subscriptions');

    const {
        // State
        youtubeUrl, setYoutubeUrl,
        podcastUrl, setPodcastUrl,
        loading, error,
        displayChannels, displayPodcasts,
        canAddMore,
        session,

        // Modal State
        showDeleteDialog, setShowDeleteDialog,
        deleteTarget, setDeleteTarget,
        loginModalOpen, setLoginModalOpen,

        // Actions
        handleYouTubeSubmit,
        handlePodcastSubmit,
        handleUnsubscribe,
        confirmUnsubscribe,
        copyRssLink,
        handleStyleChange,
        handleLanguageChange,
        getEffectiveStyle,
        getEffectiveLanguage,
    } = useChannelManager(props);

    return (
        <>
            <LoginModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
            <ConfirmDialog
                isOpen={showDeleteDialog}
                title={t('confirm_delete_title')}
                message={t('confirm_delete_desc', { name: deleteTarget?.name || '' })}
                confirmText={t('confirm')}
                cancelText={t('cancel')}
                variant="danger"
                onConfirm={confirmUnsubscribe}
                onCancel={() => {
                    setShowDeleteDialog(false);
                    setDeleteTarget(null);
                }}
            />

            <div className="space-y-8">
                <Tabs defaultValue="youtube" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-8 bg-orange-950/30 rounded-lg p-1 h-auto">
                        <TabsTrigger
                            value="youtube"
                            className="data-[state=active]:bg-orange-600 data-[state=active]:text-white text-orange-200/70 hover:text-orange-100 transition-colors py-2"
                        >
                            YouTube
                        </TabsTrigger>
                        <TabsTrigger
                            value="podcast"
                            className="data-[state=active]:bg-orange-600 data-[state=active]:text-white text-orange-200/70 hover:text-orange-100 transition-colors py-2"
                        >
                            Podcast
                        </TabsTrigger>
                    </TabsList>

                    {/* YouTube Tab */}
                    <TabsContent value="youtube" className="space-y-8">
                        <AddChannelForm
                            type="youtube"
                            value={youtubeUrl}
                            onChange={setYoutubeUrl}
                            onSubmit={handleYouTubeSubmit}
                            loading={loading}
                            canAddMore={canAddMore}
                            error={error}
                        />

                        <div className="flex flex-col items-center gap-4 w-full">
                            {displayChannels.map((channel) => (
                                <SubscriptionCard
                                    key={channel.id}
                                    type="youtube"
                                    id={channel.id}
                                    title={channel.title}
                                    description={channel.description}
                                    lastUpdated={channel.last_updated}
                                    externalUrl={`https://youtube.com/channel/${channel.youtube_id}`}
                                    summaryStyle={getEffectiveStyle((channel as any).subscriptionId || channel.id, 'youtube', (channel as any).summaryStyle || 'DEFAULT')}
                                    summaryLanguage={getEffectiveLanguage((channel as any).subscriptionId || channel.id, 'youtube', (channel as any).summaryLanguage || 'ZH_TW')}
                                    onUnsubscribe={() => handleUnsubscribe(channel.id, 'youtube', channel.title)}
                                    onCopyRss={() => copyRssLink()}
                                    onStyleChange={session ? (style) => handleStyleChange((channel as any).subscriptionId || channel.id, 'youtube', style) : undefined}
                                    onLanguageChange={session ? (lang) => handleLanguageChange((channel as any).subscriptionId || channel.id, 'youtube', lang) : undefined}
                                    onLoginRequired={() => setLoginModalOpen(true)}
                                    isAuthenticated={!!session}
                                    loading={loading}
                                />
                            ))}

                            {displayChannels.length === 0 && (
                                <div className="text-center py-12 text-gray-400">
                                    {t('empty_youtube')}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* Podcast Tab */}
                    <TabsContent value="podcast" className="space-y-8">
                        <AddChannelForm
                            type="podcast"
                            value={podcastUrl}
                            onChange={setPodcastUrl}
                            onSubmit={handlePodcastSubmit}
                            loading={loading}
                            canAddMore={canAddMore}
                            error={error}
                        />

                        <div className="flex flex-col items-center gap-4 w-full">
                            {displayPodcasts.map((podcast) => (
                                <SubscriptionCard
                                    key={podcast.id}
                                    type="podcast"
                                    id={podcast.id}
                                    title={podcast.title || 'Untitled Podcast'}
                                    description={podcast.description}
                                    lastUpdated={podcast.last_updated}
                                    externalUrl={podcast.site_url}
                                    // Cast to any to access subscription props if they exist on the podcast object
                                    // The hook already merged them
                                    summaryStyle={getEffectiveStyle((podcast as any).subscriptionId || podcast.id, 'podcast', (podcast as any).summaryStyle || 'DEFAULT')}
                                    summaryLanguage={getEffectiveLanguage((podcast as any).subscriptionId || podcast.id, 'podcast', (podcast as any).summaryLanguage || 'ZH_TW')}
                                    onUnsubscribe={() => handleUnsubscribe(podcast.id, 'podcast', podcast.title || 'this podcast')}
                                    onCopyRss={() => copyRssLink()}
                                    onStyleChange={session ? (style) => handleStyleChange((podcast as any).subscriptionId || podcast.id, 'podcast', style) : undefined}
                                    onLanguageChange={session ? (lang) => handleLanguageChange((podcast as any).subscriptionId || podcast.id, 'podcast', lang) : undefined}
                                    loading={loading}
                                    isAuthenticated={!!session}
                                    onLoginRequired={() => setLoginModalOpen(true)}
                                />
                            ))}

                            {displayPodcasts.length === 0 && (
                                <div className="text-center py-12 text-gray-400">
                                    {t('empty_podcast')}
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );
}
