'use client';

import { Plus, Loader2, Mic } from 'lucide-react';
import { AddChannelFormProps } from './types';

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

    const focusColor = isYouTube
        ? "focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.5)]"
        : "focus:border-purple-500 focus:shadow-[0_0_0_4px_rgba(168,85,247,0.5)]";

    const buttonColor = isYouTube
        ? "bg-blue-600 hover:bg-blue-700"
        : "bg-purple-600 hover:bg-purple-700";

    const Icon = isYouTube ? Plus : Mic;

    return (
        <div className="mb-8">
            <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={`w-full px-4 h-12 border border-slate-600 rounded-lg ${focusColor} outline-none transition-all text-white bg-slate-800 placeholder:text-gray-400`}
                    disabled={loading}
                />
                <button
                    type="submit"
                    disabled={loading || !canAddMore}
                    className={`w-full sm:w-auto ${buttonColor} text-white px-6 h-12 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap`}
                    title={!canAddMore ? 'Quota reached - please unsubscribe from another to add' : ''}
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
                    {buttonText}
                </button>
            </form>
            {error && (
                <p className="mt-3 text-red-500 text-sm flex items-center gap-1">
                    ⚠️ {error}
                </p>
            )}
        </div>
    );
}
