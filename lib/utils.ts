import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getSourceColor(type: 'video' | 'episode') {
  return type === 'video' ? 'bg-red-500/90 text-white' : 'bg-purple-500/90 text-white';
}

export function getSourceLabel(type: 'video' | 'episode') {
  return type === 'video' ? 'YouTube' : 'Podcast';
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}
