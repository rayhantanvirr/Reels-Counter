import React, { useState, useMemo } from 'react';
import { PlatformType, ReelRecord } from '../types';
import { PLATFORMS } from '../data/mockSampleData';
import { 
  BarChart3, 
  Clock, 
  Flame, 
  Sparkles, 
  TrendingUp, 
  Calendar, 
  Layers, 
  AlertTriangle,
  Smile,
  ShieldAlert,
  ArrowUpRight,
  Eye
} from 'lucide-react';

interface ComposeDashboardProps {
  records: ReelRecord[];
  onClearData: () => void;
  onSeedData: () => void;
}

export const ComposeDashboard: React.FC<ComposeDashboardProps> = ({
  records,
  onClearData,
  onSeedData,
}) => {
  const [selectedDays, setSelectedDays] = useState<number>(7);
  const [showAppBreakdown, setShowAppBreakdown] = useState<boolean>(false);

  // Filter records by selected time window (1, 7, 14, 30 days)
  const filteredRecords = useMemo(() => {
    const cutoff = Date.now() - selectedDays * 24 * 60 * 60 * 1000;
    return records.filter((r) => r.timestamp >= cutoff);
  }, [records, selectedDays]);

  // UNIFIED TOTAL ACROSS ALL PLATFORMS COMBINED
  const grandTotalViews = filteredRecords.length;
  const grandTotalDwellMs = useMemo(() => {
    return filteredRecords.reduce((acc, curr) => acc + curr.dwellTimeMs, 0);
  }, [filteredRecords]);

  const totalMinutes = Math.floor(grandTotalDwellMs / 1000 / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const remMinutes = totalMinutes % 60;
  const avgSeconds = grandTotalViews > 0 ? Math.round(grandTotalDwellMs / grandTotalViews / 1000) : 0;

  // Unified Daily Trend Aggregation (Total count per dateString across all apps)
  const dailyTrends = useMemo(() => {
    const map = new Map<string, { totalCount: number; totalDwellMs: number }>();

    for (let i = selectedDays - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const ds = d.toISOString().split('T')[0];
      map.set(ds, { totalCount: 0, totalDwellMs: 0 });
    }

    filteredRecords.forEach((r) => {
      if (map.has(r.dateString)) {
        const entry = map.get(r.dateString)!;
        entry.totalCount += 1;
        entry.totalDwellMs += r.dwellTimeMs;
      }
    });

    return Array.from(map.entries()).map(([dateString, val]) => ({
      dateString,
      shortDate: dateString.slice(5),
      count: val.totalCount,
      dwellMs: val.totalDwellMs,
    }));
  }, [filteredRecords, selectedDays]);

  const maxDailyCount = useMemo(() => {
    return Math.max(...dailyTrends.map((d) => d.count), 1);
  }, [dailyTrends]);

  // Brainrot severity calculator on total combined reels
  const dailyAverageReels = selectedDays > 0 ? Math.round(grandTotalViews / selectedDays) : grandTotalViews;
  const brainrotLevel = useMemo(() => {
    if (dailyAverageReels < 12) {
      return {
        title: 'Zen Mind (Low Usage)',
        desc: 'Healthy total short-form video consumption across all platforms.',
        emoji: '🌱',
        badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        progressBar: 'bg-emerald-400',
        score: 15,
      };
    } else if (dailyAverageReels < 30) {
      return {
        title: 'Moderate Doomscroll',
        desc: 'Regular short-form exposure. Monitor daily total screen time.',
        emoji: '🤨',
        badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        progressBar: 'bg-blue-400',
        score: 45,
      };
    } else if (dailyAverageReels < 55) {
      return {
        title: 'Dopamine Loop Alert',
        desc: 'Significant total reels watched across apps. Attention fragmentation risk.',
        emoji: '🫠',
        badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        progressBar: 'bg-amber-400',
        score: 75,
      };
    } else if (dailyAverageReels < 90) {
      return {
        title: 'High Brainrot Warning',
        desc: 'High total volume. Multiple doomscroll sessions accumulating.',
        emoji: '💀',
        badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        progressBar: 'bg-rose-400',
        score: 90,
      };
    } else {
      return {
        title: 'Critical Brainrot (Zombie Mode)',
        desc: 'Overwhelming combined usage across Instagram, TikTok, YouTube & Facebook.',
        emoji: '🧟',
        badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        progressBar: 'bg-purple-400',
        score: 100,
      };
    }
  }, [dailyAverageReels]);

  // Optional platform breakdown
  const platformStats = useMemo(() => {
    const stats: Record<PlatformType, { count: number; dwellMs: number }> = {
      INSTAGRAM: { count: 0, dwellMs: 0 },
      TIKTOK: { count: 0, dwellMs: 0 },
      YOUTUBE_SHORTS: { count: 0, dwellMs: 0 },
      FACEBOOK: { count: 0, dwellMs: 0 },
    };

    filteredRecords.forEach((r) => {
      if (stats[r.platform]) {
        stats[r.platform].count += 1;
        stats[r.platform].dwellMs += r.dwellTimeMs;
      }
    });

    return (Object.keys(stats) as PlatformType[]).map((key) => {
      const item = stats[key];
      const percent = grandTotalViews > 0 ? (item.count / grandTotalViews) * 100 : 0;
      return {
        platform: key,
        count: item.count,
        dwellMs: item.dwellMs,
        percent,
      };
    }).sort((a, b) => b.count - a.count);
  }, [filteredRecords, grandTotalViews]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Bar / Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-neutral-900/80 border border-neutral-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold tracking-tight text-white">
              Unified Total Dashboard
            </span>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded font-mono font-bold">
              All Apps Combined
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Tracks total reels viewed across Instagram, TikTok, YouTube Shorts, and Facebook in one single counter.
          </p>
        </div>

        {/* 1-30 Day Filter Chip Row */}
        <div className="flex items-center gap-1.5 bg-neutral-950 p-1.5 rounded-xl border border-neutral-800 self-stretch sm:self-auto overflow-x-auto">
          {[
            { days: 1, label: 'Today' },
            { days: 7, label: '7 Days' },
            { days: 14, label: '14 Days' },
            { days: 30, label: '30 Days' },
          ].map(({ days, label }) => (
            <button
              key={days}
              onClick={() => setSelectedDays(days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                selectedDays === days
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Hero Metrics Row: Combined Grand Total */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1: Grand Total Reels */}
        <div className="bg-gradient-to-b from-indigo-950/40 to-neutral-900/90 border border-indigo-500/30 p-5 rounded-2xl relative overflow-hidden group shadow-lg">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Layers className="w-16 h-16 text-indigo-400" />
          </div>
          <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
            Grand Total Reels Watched
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-5xl font-black text-white tracking-tight">{grandTotalViews}</span>
            <span className="text-xs text-neutral-400 font-semibold">reels total</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-indigo-300 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Avg {dailyAverageReels} reels per day</span>
          </div>
        </div>

        {/* Metric 2: Total Time Consumed */}
        <div className="bg-neutral-900/90 border border-neutral-800 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock className="w-16 h-16 text-emerald-400" />
          </div>
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            Combined Time Lost
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-black text-white tracking-tight">
              {totalHours > 0 ? `${totalHours}h ${remMinutes}m` : `${remMinutes}m`}
            </span>
            <span className="text-xs text-neutral-500 font-medium">total dwell</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <Clock className="w-3.5 h-3.5" />
            <span>{totalMinutes} total minutes watched</span>
          </div>
        </div>

        {/* Metric 3: Avg Dwell Duration */}
        <div className="bg-neutral-900/90 border border-neutral-800 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Sparkles className="w-16 h-16 text-amber-400" />
          </div>
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            Avg Dwell per Video
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-black text-white tracking-tight">{avgSeconds}s</span>
            <span className="text-xs text-neutral-500 font-medium">per reel</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-400 font-medium">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Only &gt;1.5s intentional views counted</span>
          </div>
        </div>
      </div>

      {/* Brainrot Severity Index Banner */}
      <div className="bg-neutral-900/80 border border-neutral-800 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="text-4xl p-3 bg-neutral-950 rounded-2xl border border-neutral-800 shrink-0">
            {brainrotLevel.emoji}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Overall Dopamine Status:</span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full border font-bold ${brainrotLevel.badgeColor}`}>
                {brainrotLevel.title}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">{brainrotLevel.desc}</p>
          </div>
        </div>

        <div className="w-full sm:w-48 space-y-1.5">
          <div className="flex justify-between text-[11px] font-semibold text-neutral-400">
            <span>Combined Load</span>
            <span>{brainrotLevel.score}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${brainrotLevel.progressBar}`} 
              style={{ width: `${brainrotLevel.score}%` }} 
            />
          </div>
        </div>
      </div>

      {/* Daily Total Trend Chart (All apps combined per calendar day) */}
      <div className="bg-neutral-900/80 border border-neutral-800 p-5 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              Daily Total Reels Trend (Last {selectedDays} Days)
            </h3>
            <p className="text-xs text-neutral-400">
              Total number of short videos watched each day across all apps combined
            </p>
          </div>
          <span className="text-xs font-mono text-neutral-400">
            Peak: <strong className="text-white">{maxDailyCount}</strong> reels/day
          </span>
        </div>

        {/* Bar chart container */}
        <div className="h-48 pt-4 flex items-end gap-1.5 sm:gap-2 border-b border-neutral-800/80 pb-2">
          {dailyTrends.map((day, idx) => {
            const heightPercent = maxDailyCount > 0 ? (day.count / maxDailyCount) * 100 : 0;
            return (
              <div 
                key={day.dateString} 
                className="flex-1 flex flex-col items-center h-full justify-end group relative"
              >
                {/* Tooltip on hover */}
                <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-950 text-white border border-neutral-700 text-[10px] px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap z-20">
                  <span className="font-bold">{day.dateString}</span>: {day.count} total reels ({Math.round(day.dwellMs / 60000)}m)
                </div>

                <div 
                  className="w-full rounded-t-md transition-all duration-300 group-hover:brightness-125 bg-gradient-to-t from-indigo-700 to-indigo-400"
                  style={{ height: `${Math.max(6, heightPercent)}%` }}
                />
                <span className="text-[9px] font-mono text-neutral-500 mt-2 truncate max-w-full">
                  {selectedDays <= 7 ? day.shortDate : (idx % Math.ceil(selectedDays / 7) === 0 ? day.shortDate : '')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Optional Platform Breakdown Section */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowAppBreakdown((prev) => !prev)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-neutral-800/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-neutral-400" />
            <span className="text-xs font-bold text-neutral-300">
              {showAppBreakdown ? 'Hide Individual App Origin Details' : 'Show Optional App Breakdown (Underlying Sources)'}
            </span>
          </div>
          <span className="text-xs text-indigo-400 font-semibold">
            {showAppBreakdown ? 'Collapse ▲' : 'Expand ▼'}
          </span>
        </button>

        {showAppBreakdown && (
          <div className="p-4 pt-0 border-t border-neutral-800/80 space-y-3 animate-in fade-in duration-200">
            <p className="text-[11px] text-neutral-400">
              Breakdown of how your {grandTotalViews} total reels were distributed across individual services:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {platformStats.map((item) => {
                const pConfig = PLATFORMS[item.platform];
                return (
                  <div 
                    key={item.platform}
                    className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pConfig.brandColor }} />
                      <span className="text-xs font-semibold text-white">{pConfig.name}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-neutral-300">
                      {item.count} ({item.percent.toFixed(0)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Actions (Reset, Seed) */}
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={onSeedData}
          className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          Seed Sample Data
        </button>
        <button
          onClick={onClearData}
          className="px-3 py-2 bg-neutral-800 hover:bg-rose-950/40 text-neutral-400 hover:text-rose-300 rounded-xl text-xs font-semibold transition-colors"
        >
          Clear Records
        </button>
      </div>
    </div>
  );
};
