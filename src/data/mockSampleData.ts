import { PlatformConfig, PlatformType, ReelRecord, SimulatedVideo } from '../types';

export const PLATFORMS: Record<PlatformType, PlatformConfig> = {
  INSTAGRAM: {
    id: 'INSTAGRAM',
    name: 'Instagram Reels',
    packageName: 'com.instagram.android',
    iconName: 'Instagram',
    brandColor: '#E1306C',
    accentColor: '#FD1D1D',
    feedName: 'Reels Viewer',
    shortName: 'IG Reels',
  },
  TIKTOK: {
    id: 'TIKTOK',
    name: 'TikTok',
    packageName: 'com.zhiliaoapp.musically',
    iconName: 'Music',
    brandColor: '#00F2FE',
    accentColor: '#FE0979',
    feedName: 'For You Page',
    shortName: 'TikTok',
  },
  YOUTUBE_SHORTS: {
    id: 'YOUTUBE_SHORTS',
    name: 'YouTube Shorts',
    packageName: 'com.google.android.youtube',
    iconName: 'Youtube',
    brandColor: '#FF0000',
    accentColor: '#CC0000',
    feedName: 'Shorts Shelf',
    shortName: 'YT Shorts',
  },
  FACEBOOK: {
    id: 'FACEBOOK',
    name: 'Facebook Reels',
    packageName: 'com.facebook.katana',
    iconName: 'Facebook',
    brandColor: '#1877F2',
    accentColor: '#0B5BC5',
    feedName: 'Reels & Short Video',
    shortName: 'FB Reels',
  },
};

export const SIMULATED_VIDEOS: Record<PlatformType, SimulatedVideo[]> = {
  INSTAGRAM: [
    {
      id: 'ig-1',
      platform: 'INSTAGRAM',
      creator: 'Elena Rostova',
      handle: '@elenacooks',
      caption: 'Crispy Garlic Butter Smashed Potatoes 🥔 Wait for that crunch! #recipe #foodie #reels',
      audio: 'Original Audio • elenacooks',
      likes: '482K',
      comments: '3.4K',
      shares: '91K',
      gradient: 'from-amber-700 via-orange-800 to-stone-900',
    },
    {
      id: 'ig-2',
      platform: 'INSTAGRAM',
      creator: 'DevCraft Weekly',
      handle: '@devcraft',
      caption: '3 Kotlin tricks that feel illegal to know 🚀 Destructuring declarations in lambdas!',
      audio: 'Lo-Fi Chill Beats • Synthwave Radio',
      likes: '124K',
      comments: '890',
      shares: '28K',
      gradient: 'from-purple-900 via-indigo-950 to-slate-900',
    },
    {
      id: 'ig-3',
      platform: 'INSTAGRAM',
      creator: 'Kyoto Hidden Gems',
      handle: '@kyotowander',
      caption: 'The secret bamboo path no tourists know about in Arashiyama 🎋 Early morning vibes.',
      audio: 'Japanese Traditional Zen Flute',
      likes: '891K',
      comments: '4.2K',
      shares: '150K',
      gradient: 'from-emerald-900 via-teal-950 to-neutral-900',
    },
  ],
  TIKTOK: [
    {
      id: 'tt-1',
      platform: 'TIKTOK',
      creator: 'Marcus Neon',
      handle: '@marcustech',
      caption: 'POV: Your code works on the first run without a single compiler error 😱 #coding #programmer #relatable',
      audio: 'sound - funny laugh track remix',
      likes: '1.2M',
      comments: '18.9K',
      shares: '210K',
      gradient: 'from-cyan-900 via-sky-950 to-zinc-900',
    },
    {
      id: 'tt-2',
      platform: 'TIKTOK',
      creator: 'Gym Motivation HQ',
      handle: '@dailygrindfit',
      caption: 'Day 120 of discipline over motivation. Do the reps even when you feel sluggish. #fitness #grind',
      audio: 'Tevez phonk - Brazilian Phonk',
      likes: '640K',
      comments: '5.1K',
      shares: '77K',
      gradient: 'from-red-950 via-rose-950 to-stone-950',
    },
    {
      id: 'tt-3',
      platform: 'TIKTOK',
      creator: 'Sofi Cat Tales',
      handle: '@sofitheorange',
      caption: 'He discovered his reflection for the 100th time today 🐱 sound on for purrs',
      audio: 'funny whimsical cat song',
      likes: '2.8M',
      comments: '34K',
      shares: '430K',
      gradient: 'from-amber-900 via-yellow-950 to-stone-900',
    },
  ],
  YOUTUBE_SHORTS: [
    {
      id: 'yt-1',
      platform: 'YOUTUBE_SHORTS',
      creator: 'Veritasium Shorts',
      handle: '@veritasium',
      caption: 'Why do mirrors flip horizontally but never vertically? The physics will blow your mind.',
      audio: 'Sound used: Veritasium Original',
      likes: '780K',
      comments: '12.5K',
      shares: '54K',
      gradient: 'from-blue-950 via-indigo-950 to-black',
    },
    {
      id: 'yt-2',
      platform: 'YOUTUBE_SHORTS',
      creator: 'Android Developers',
      handle: '@androiddevelopers',
      caption: 'Jetpack Compose LookaheadScope for fluid layout animations in Compose 1.7! 📱',
      audio: 'Original Audio - Google Android Team',
      likes: '45K',
      comments: '312',
      shares: '4.8K',
      gradient: 'from-green-950 via-emerald-950 to-gray-950',
    },
  ],
  FACEBOOK: [
    {
      id: 'fb-1',
      platform: 'FACEBOOK',
      creator: 'Woodworking Craftsmen',
      handle: 'Artisan Woodcraft',
      caption: 'Restoring a 1940s oak carpenter workbench. The beeswax finish reveal at the end! 🪚',
      audio: 'Satisfying Wood Scraping ASMR',
      likes: '310K',
      comments: '8.4K',
      shares: '45K',
      gradient: 'from-yellow-950 via-amber-950 to-zinc-900',
    },
    {
      id: 'fb-2',
      platform: 'FACEBOOK',
      creator: 'Classic Auto Moments',
      handle: 'Vintage Motors Club',
      caption: 'Cold start of a 1969 Dodge Charger 440 R/T after 15 years in a barn 🏎️ Pure American V8 rumble',
      audio: 'Original Engine Rumble Audio',
      likes: '512K',
      comments: '14K',
      shares: '89K',
      gradient: 'from-stone-900 via-zinc-950 to-neutral-900',
    },
  ],
};

/**
 * Generates 30 days of realistic sample records for demonstration and Room SQLite verification.
 */
export function generateSeedData(): ReelRecord[] {
  const records: ReelRecord[] = [];
  let recordId = 1;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const platforms: PlatformType[] = ['INSTAGRAM', 'TIKTOK', 'YOUTUBE_SHORTS', 'FACEBOOK'];

  for (let d = 29; d >= 0; d--) {
    const dayTimestamp = now - d * dayMs;
    const dateObj = new Date(dayTimestamp);
    const dateString = dateObj.toISOString().split('T')[0];

    // Weekend vs weekday variance
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
    const baseCount = isWeekend ? 35 : 20;
    const dailyReels = baseCount + Math.floor(Math.sin(d * 0.8) * 12) + Math.floor(Math.random() * 8);

    for (let r = 0; r < dailyReels; r++) {
      // Pick platform with realistic distribution (TikTok + IG dominant)
      const rand = Math.random();
      let platform: PlatformType;
      if (rand < 0.42) platform = 'TIKTOK';
      else if (rand < 0.76) platform = 'INSTAGRAM';
      else if (rand < 0.92) platform = 'YOUTUBE_SHORTS';
      else platform = 'FACEBOOK';

      // Realistic dwell time: 2.2s to 45s (must be >= 1500ms since it passed dwell threshold)
      const dwellTimeMs = 1500 + Math.floor(Math.random() * 18000) + (Math.random() > 0.8 ? 25000 : 0);
      const reelTime = dayTimestamp + Math.floor(Math.random() * (dayMs - 1000));

      records.push({
        id: recordId++,
        platform,
        timestamp: reelTime,
        dwellTimeMs,
        dateString,
        creatorTag: `@creator_${Math.floor(Math.random() * 100)}`,
        audioTitle: `Sound #${Math.floor(Math.random() * 50)}`,
      });
    }
  }

  return records;
}
