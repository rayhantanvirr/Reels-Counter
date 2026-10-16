export type PlatformType = 'INSTAGRAM' | 'TIKTOK' | 'YOUTUBE_SHORTS' | 'FACEBOOK';

export interface PlatformConfig {
  id: PlatformType;
  name: string;
  packageName: string;
  iconName: string;
  brandColor: string;
  accentColor: string;
  feedName: string;
  shortName: string;
}

export interface ReelRecord {
  id: number;
  platform: PlatformType;
  timestamp: number;
  dwellTimeMs: number;
  dateString: string; // YYYY-MM-DD
  creatorTag?: string;
  audioTitle?: string;
}

export interface DailyPlatformAggregate {
  dateString: string;
  platform: PlatformType;
  totalViews: number;
  totalDwellMs: number;
}

export interface PlatformSummary {
  platform: PlatformType;
  totalViews: number;
  totalDwellMs: number;
  percentage: number;
}

export interface AccessibilityLogEvent {
  id: string;
  timestamp: string;
  eventType: 'TYPE_VIEW_SCROLLED' | 'TYPE_WINDOW_STATE_CHANGED' | 'TYPE_WINDOW_CONTENT_CHANGED';
  packageName: string;
  isReelDetected: boolean;
  dwellStatus: 'IDLE' | 'DWELLING' | 'COUNTED' | 'DISCARDED_FAST_SWIPE';
  message: string;
  nodeSignature?: string;
}

export interface SimulatedVideo {
  id: string;
  platform: PlatformType;
  creator: string;
  handle: string;
  caption: string;
  audio: string;
  likes: string;
  comments: string;
  shares: string;
  gradient: string;
  isRegularFeed?: boolean;
}
