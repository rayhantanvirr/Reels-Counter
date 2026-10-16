import React, { useState, useEffect, useRef } from 'react';
import { 
  PlatformType, 
  AccessibilityLogEvent, 
  ReelRecord, 
  SimulatedVideo 
} from '../types';
import { PLATFORMS, SIMULATED_VIDEOS } from '../data/mockSampleData';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Music2, 
  ChevronUp, 
  ChevronDown, 
  Smartphone, 
  Volume2, 
  Sparkles,
  Zap,
  Clock,
  Layers,
  Home,
  Grid,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

interface PhoneSimulatorProps {
  currentPlatform: PlatformType;
  onChangePlatform: (p: PlatformType) => void;
  onNewReelLogged: (record: ReelRecord) => void;
  onAccessibilityLog: (event: AccessibilityLogEvent) => void;
  overlayEnabled: boolean;
  onToggleOverlay: () => void;
  totalSessionReels: number;
  sessionDurationSeconds: number;
}

export const PhoneSimulator: React.FC<PhoneSimulatorProps> = ({
  currentPlatform,
  onChangePlatform,
  onNewReelLogged,
  onAccessibilityLog,
  overlayEnabled,
  onToggleOverlay,
  totalSessionReels,
  sessionDurationSeconds,
}) => {
  const [videoIndex, setVideoIndex] = useState(0);
  // Phone screens: 'REELS' (inside active reel container), 'APP_FEED' (standard profile/grid), 'HOME_SCREEN' (Android desktop)
  const [activeScreen, setActiveScreen] = useState<'REELS' | 'APP_FEED' | 'HOME_SCREEN'>('REELS');
  const [dwellProgress, setDwellProgress] = useState(0); // 0 to 100%
  const [dwellCounted, setDwellCounted] = useState(false);
  const [dwellSeconds, setDwellSeconds] = useState(0);
  const [feedbackToast, setFeedbackToast] = useState<{ text: string; type: 'success' | 'warning' | 'info' } | null>(null);

  // Floating Overlay Position (within phone frame)
  const [overlayPos, setOverlayPos] = useState({ x: 20, y: 150 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });

  const dwellTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dwellStartTimeRef = useRef<number>(0);

  const videos = SIMULATED_VIDEOS[currentPlatform] || [];
  const currentVideo: SimulatedVideo = videos[videoIndex % videos.length] || {
    id: 'placeholder',
    platform: currentPlatform,
    creator: 'Creator',
    handle: '@handle',
    caption: 'Short-form content stream',
    audio: 'Original Audio',
    likes: '10K',
    comments: '500',
    shares: '200',
    gradient: 'from-slate-900 to-zinc-950',
  };

  const platformConfig = PLATFORMS[currentPlatform];

  // Reaction emoji based on total reels watched across ALL apps
  const getReactionEmoji = (count: number) => {
    if (count === 0) return '🌱';
    if (count <= 3) return '🙂';
    if (count <= 8) return '🤨';
    if (count <= 15) return '🫠';
    if (count <= 25) return '💀';
    if (count <= 40) return '🧟';
    return '🧠💥';
  };

  const showToast = (text: string, type: 'success' | 'warning' | 'info') => {
    setFeedbackToast({ text, type });
    setTimeout(() => {
      setFeedbackToast(null);
    }, 2800);
  };

  // Launch an app directly from the phone screen
  const launchApp = (platform: PlatformType) => {
    onChangePlatform(platform);
    setActiveScreen('REELS');
    setVideoIndex(0);
    onAccessibilityLog({
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      eventType: 'TYPE_WINDOW_STATE_CHANGED',
      packageName: PLATFORMS[platform].packageName,
      isReelDetected: true,
      dwellStatus: 'IDLE',
      message: `User launched ${PLATFORMS[platform].name}. AccessibilityService attached to ${PLATFORMS[platform].packageName}.`,
    });
    showToast(`Opened ${PLATFORMS[platform].name}`, 'info');
  };

  // Reset & start dwell tracker when video changes or container changes
  useEffect(() => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);

    setDwellProgress(0);
    setDwellCounted(false);
    setDwellSeconds(0);

    if (activeScreen !== 'REELS') {
      onAccessibilityLog({
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toLocaleTimeString(),
        eventType: 'TYPE_WINDOW_STATE_CHANGED',
        packageName: activeScreen === 'HOME_SCREEN' ? 'com.google.android.apps.nexuslauncher' : platformConfig.packageName,
        isReelDetected: false,
        dwellStatus: 'IDLE',
        message: activeScreen === 'HOME_SCREEN' 
          ? `User on Android Home Screen. Overlay hidden.` 
          : `User in ${platformConfig.name} standard profile/feed. Not a vertical reel. Overlay hidden.`,
      });
      return;
    }

    dwellStartTimeRef.current = Date.now();

    // Log scroll/window detection
    onAccessibilityLog({
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      eventType: 'TYPE_VIEW_SCROLLED',
      packageName: platformConfig.packageName,
      isReelDetected: true,
      dwellStatus: 'DWELLING',
      message: `Reel in viewport (${platformConfig.shortName}). Running 1500ms debounce verification...`,
      nodeSignature: `${currentPlatform}_${currentVideo.handle}`,
    });

    const startTime = Date.now();
    const thresholdMs = 1500;

    // Progress bar animation
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / thresholdMs) * 100));
      setDwellProgress(pct);

      if (elapsed >= thresholdMs) {
        setDwellSeconds(Math.floor((elapsed - thresholdMs) / 1000) + 1);
      }
    }, 50);

    // Dwell threshold reached (1.5 seconds)
    dwellTimerRef.current = setTimeout(() => {
      setDwellCounted(true);

      const record: ReelRecord = {
        id: Date.now(),
        platform: currentPlatform,
        timestamp: Date.now(),
        dwellTimeMs: 1500,
        dateString: new Date().toISOString().split('T')[0],
        creatorTag: currentVideo.handle,
        audioTitle: currentVideo.audio,
      };

      onNewReelLogged(record);

      onAccessibilityLog({
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toLocaleTimeString(),
        eventType: 'TYPE_WINDOW_CONTENT_CHANGED',
        packageName: platformConfig.packageName,
        isReelDetected: true,
        dwellStatus: 'COUNTED',
        message: `✓ 1.5s Dwell reached in ${platformConfig.shortName}! Added +1 to Total Count (Grand Total: ${totalSessionReels + 1}).`,
        nodeSignature: `TOTAL_COUNT_${totalSessionReels + 1}`,
      });

      showToast(`+1 Added to Grand Total (#${totalSessionReels + 1})`, 'success');
    }, thresholdMs);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    };
  }, [videoIndex, activeScreen, currentPlatform]);

  // Handle Swipe Up (Next Video)
  const handleNextVideo = (forceFastSwipe: boolean = false) => {
    const elapsed = Date.now() - dwellStartTimeRef.current;
    if (activeScreen === 'REELS' && elapsed < 1500) {
      // Discarded fast swipe!
      onAccessibilityLog({
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toLocaleTimeString(),
        eventType: 'TYPE_VIEW_SCROLLED',
        packageName: platformConfig.packageName,
        isReelDetected: true,
        dwellStatus: 'DISCARDED_FAST_SWIPE',
        message: `⚠ Swiped away at ${elapsed}ms (< 1500ms). Fast-swipe discarded by debounce mechanism.`,
      });
      showToast(`Fast Swipe (${elapsed}ms) Discarded! Not counted.`, 'warning');
    }

    setVideoIndex((prev) => prev + 1);
  };

  // Handle Swipe Down (Previous Video)
  const handlePrevVideo = () => {
    setVideoIndex((prev) => Math.max(0, prev - 1));
  };

  // Dragging logic for floating overlay inside phone screen
  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startX: overlayPos.x,
      startY: overlayPos.y,
    };
  };

  const handlePhoneMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    const newX = Math.max(10, Math.min(230, dragStartRef.current.startX + deltaX));
    const newY = Math.max(70, Math.min(520, dragStartRef.current.startY + deltaY));
    setOverlayPos({ x: newX, y: newY });
  };

  const handlePhoneMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    // Snap to edge (left or right)
    setOverlayPos((prev) => ({
      x: prev.x > 125 ? 200 : 16,
      y: prev.y,
    }));
  };

  return (
    <div className="flex flex-col lg:flex-row items-center justify-center gap-6 p-2 sm:p-4">
      {/* Phone Simulator Frame */}
      <div 
        className="relative w-[340px] h-[670px] bg-neutral-950 rounded-[44px] p-3 shadow-2xl border-4 border-neutral-700/60 select-none overflow-hidden"
        onMouseMove={handlePhoneMouseMove}
        onMouseUp={handlePhoneMouseUp}
        onMouseLeave={handlePhoneMouseUp}
      >
        {/* Phone Speaker Notch */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-neutral-900 rounded-full z-40 flex items-center justify-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-neutral-950 border border-neutral-800" />
          <div className="w-10 h-1.5 rounded-full bg-neutral-800" />
        </div>

        {/* Screen Content */}
        <div className="relative w-full h-full rounded-[34px] overflow-hidden bg-neutral-950 flex flex-col justify-between">
          
          {/* Top Android Status Bar */}
          <div className="relative z-30 pt-3 px-6 flex justify-between items-center text-xs text-white/80 font-medium tracking-tight">
            <span>9:41</span>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold">5G</span>
              <span>100%</span>
            </div>
          </div>

          {/* Toast Notification inside phone */}
          {feedbackToast && (
            <div className={`absolute top-12 left-4 right-4 z-50 text-xs px-3 py-2 rounded-xl backdrop-blur-md shadow-lg border flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200 ${
              feedbackToast.type === 'success' 
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200' 
                : feedbackToast.type === 'warning'
                ? 'bg-amber-950/90 border-amber-500/40 text-amber-200'
                : 'bg-indigo-950/90 border-indigo-500/40 text-indigo-200'
            }`}>
              {feedbackToast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span className="font-medium truncate">{feedbackToast.text}</span>
            </div>
          )}

          {/* LIVE FLOATING OVERLAY: SHOWS UNIFIED TOTAL COUNT */}
          {overlayEnabled && activeScreen === 'REELS' && (
            <div
              onMouseDown={handleOverlayMouseDown}
              style={{
                transform: `translate3d(${overlayPos.x}px, ${overlayPos.y}px, 0px)`,
                cursor: isDragging ? 'grabbing' : 'grab',
              }}
              className="absolute z-40 transition-all duration-75 active:scale-95 group"
            >
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-900/95 border border-white/20 backdrop-blur-md shadow-2xl text-white">
                <span className="text-xl animate-bounce select-none">
                  {getReactionEmoji(totalSessionReels)}
                </span>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black tracking-tight text-white uppercase">
                      Total: #{totalSessionReels}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <span className="text-[9px] text-white/60 font-mono">
                    All apps combined
                  </span>
                </div>
              </div>
              <div className="text-[8px] text-center text-white/40 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                drag to move
              </div>
            </div>
          )}

          {/* SCREEN 1: ACTIVE REEL / SHORT VIEW */}
          {activeScreen === 'REELS' && (
            <div className={`absolute inset-0 bg-gradient-to-b ${currentVideo.gradient} flex flex-col justify-between p-4 pt-12`}>
              
              {/* Top Bar inside Reel */}
              <div className="flex justify-between items-center text-white z-20">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setActiveScreen('APP_FEED')}
                    className="text-xs font-bold tracking-wider uppercase bg-black/50 px-2.5 py-1 rounded-full backdrop-blur-sm border border-white/10 hover:bg-black/70 flex items-center gap-1"
                  >
                    <span>{platformConfig.shortName}</span>
                  </button>
                  <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/20 font-mono">
                    Global Total: #{totalSessionReels}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-white/80">
                  <Volume2 className="w-4 h-4" />
                </div>
              </div>

              {/* Dwell Timer Indicator Pill / Progress bar */}
              <div className="z-20 my-auto mx-auto bg-black/50 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-full flex items-center gap-2 text-white shadow-xl">
                <div className="relative w-4 h-4 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-white/20"
                      strokeWidth="4"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className={dwellCounted ? "text-emerald-400" : "text-amber-400"}
                      strokeDasharray={`${dwellProgress}, 100`}
                      strokeWidth="4"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                </div>
                <span className="text-[10px] font-mono font-medium">
                  {dwellCounted ? (
                    <span className="text-emerald-400 font-bold">Counted into Grand Total</span>
                  ) : (
                    <span>Dwell: {dwellProgress}% (&lt;1.5s)</span>
                  )}
                </span>
              </div>

              {/* Bottom Metadata & Right Action Stack */}
              <div className="flex items-end justify-between z-20 pb-4">
                {/* Left: Creator info & caption */}
                <div className="max-w-[70%] space-y-2 text-white">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white/20 border border-white/40 flex items-center justify-center font-bold text-xs">
                      {currentVideo.creator.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-tight">{currentVideo.creator}</p>
                      <p className="text-[10px] text-white/70">{currentVideo.handle}</p>
                    </div>
                  </div>
                  <p className="text-xs text-white/90 line-clamp-2 leading-relaxed">
                    {currentVideo.caption}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-white/80 bg-black/40 w-fit px-2 py-0.5 rounded-full backdrop-blur-xs">
                    <Music2 className="w-3 h-3 text-white/90 animate-spin" style={{ animationDuration: '4s' }} />
                    <span className="truncate max-w-[140px]">{currentVideo.audio}</span>
                  </div>
                </div>

                {/* Right: Interaction Stack */}
                <div className="flex flex-col items-center gap-4 text-white">
                  <button className="flex flex-col items-center gap-0.5 group">
                    <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Heart className="w-5 h-5 text-white fill-white/10" />
                    </div>
                    <span className="text-[10px] font-bold">{currentVideo.likes}</span>
                  </button>

                  <button className="flex flex-col items-center gap-0.5 group">
                    <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <MessageCircle className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[10px] font-bold">{currentVideo.comments}</span>
                  </button>

                  <button className="flex flex-col items-center gap-0.5 group">
                    <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Share2 className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[10px] font-bold">{currentVideo.shares}</span>
                  </button>

                  {/* Audio Disc */}
                  <div className="w-8 h-8 rounded-full border-2 border-white/60 bg-neutral-900 flex items-center justify-center animate-spin" style={{ animationDuration: '5s' }}>
                    <div className="w-2.5 h-2.5 rounded-full bg-white/80" />
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* SCREEN 2: STANDARD APP PROFILE / FEED */}
          {activeScreen === 'APP_FEED' && (
            <div className="absolute inset-0 bg-neutral-900 text-white p-4 pt-12 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                  <h3 className="text-sm font-bold">{platformConfig.name} Feed</h3>
                  <button 
                    onClick={() => setActiveScreen('HOME_SCREEN')}
                    className="text-[10px] bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1 rounded-lg text-neutral-300"
                  >
                    Go to Home
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-neutral-800/60 border border-neutral-700/40 text-center space-y-2">
                  <p className="text-xs font-semibold text-neutral-200">Standard Grid / Profile View</p>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    AccessibilityService heuristic confirms: Not currently watching reels. Floating overlay auto-hidden.
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setActiveScreen('REELS')}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Layers className="w-4 h-4" />
                Tap to Watch Reels &amp; Count
              </button>
            </div>
          )}

          {/* SCREEN 3: ANDROID HOME SCREEN / APP LAUNCHER */}
          {activeScreen === 'HOME_SCREEN' && (
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-neutral-950 to-black text-white p-5 pt-14 flex flex-col justify-between">
              <div>
                <p className="text-[11px] text-neutral-400 font-medium">Android Home Screen</p>
                <h3 className="text-base font-extrabold text-white mt-1">Tap an app to open &amp; watch:</h3>
                <p className="text-[11px] text-indigo-400 mt-0.5">
                  Reels viewed in ANY of these will count toward the ONE total!
                </p>

                {/* Grid of app icons */}
                <div className="grid grid-cols-2 gap-3 mt-6">
                  {(Object.keys(PLATFORMS) as PlatformType[]).map((pKey) => {
                    const p = PLATFORMS[pKey];
                    return (
                      <button
                        key={pKey}
                        onClick={() => launchApp(pKey)}
                        className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 hover:border-neutral-600 flex flex-col items-center gap-2 text-center transition-all group hover:scale-105"
                      >
                        <div 
                          className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:rotate-3"
                          style={{ backgroundColor: p.brandColor }}
                        >
                          <Smartphone className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xs font-bold text-white">{p.name}</span>
                        <span className="text-[10px] text-neutral-500 font-mono truncate max-w-full">
                          {p.packageName.split('.').pop()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 text-center">
                <span className="text-xs text-neutral-400 font-medium">
                  Current Grand Total Watched: <strong className="text-white font-mono">#{totalSessionReels}</strong>
                </span>
              </div>
            </div>
          )}

          {/* Android Bottom Navigation Bar */}
          <div className="relative z-30 pb-2 px-10 flex justify-between items-center text-white/50 bg-black/40 backdrop-blur-sm">
            <button 
              onClick={handlePrevVideo} 
              className="p-1 hover:text-white transition-colors" 
              title="Previous reel"
            >
              <div className="w-3 h-3 border-l-2 border-b-2 border-white/60 -rotate-45" />
            </button>
            <button 
              onClick={() => setActiveScreen(activeScreen === 'HOME_SCREEN' ? 'REELS' : 'HOME_SCREEN')}
              className="w-4 h-4 rounded-full border-2 border-white/60 hover:border-white transition-colors flex items-center justify-center"
              title="Home button (Launcher)"
            />
            <button 
              onClick={() => handleNextVideo(false)} 
              className="p-1 hover:text-white transition-colors" 
              title="Next reel"
            >
              <div className="w-3 h-3 border-2 border-white/60 rounded-xs" />
            </button>
          </div>

        </div>
      </div>

      {/* Simulator Control & Information Panel */}
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-5">
        
        {/* Unified Total Counter Hero Callout */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/60 to-purple-950/60 border border-indigo-500/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
              Single Unified Grand Total
            </span>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-mono font-bold">
              All Apps Combined
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{totalSessionReels}</span>
            <span className="text-xs text-neutral-300">Total Reels &amp; Shorts Watched</span>
          </div>
          <p className="text-[11px] text-neutral-300 leading-relaxed">
            As requested: No separate silo counts. When you view reels in Instagram, TikTok, YouTube Shorts, or Facebook, they all increment this <strong>one continuous total</strong>.
          </p>
        </div>

        {/* In-Phone App Launching */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-neutral-200">
              Open App on Phone:
            </label>
            <button
              onClick={() => setActiveScreen('HOME_SCREEN')}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
            >
              <Home className="w-3 h-3" />
              Go to Home Screen
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(PLATFORMS) as PlatformType[]).map((pKey) => {
              const p = PLATFORMS[pKey];
              const isSelected = currentPlatform === pKey && activeScreen === 'REELS';
              return (
                <button
                  key={pKey}
                  onClick={() => launchApp(pKey)}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                    isSelected
                      ? 'bg-neutral-800 border-indigo-500 text-white shadow-sm ring-1 ring-indigo-500'
                      : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: p.brandColor }}
                  />
                  <div className="truncate">
                    <p className="text-xs font-semibold leading-none">{p.name}</p>
                    <p className="text-[10px] text-neutral-500 truncate mt-0.5">{p.shortName}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Test Fast-Swipe vs Normal Watch */}
        <div className="pt-2 border-t border-neutral-800/80 space-y-2">
          <label className="text-xs font-bold text-neutral-300 block">
            Test Dwell Mechanism (&gt;1.5s Threshold)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleNextVideo(true)}
              className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-600/40 hover:bg-amber-900/40 text-amber-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Fast-Swipe (&lt;1.5s Discard)
            </button>
            <button
              onClick={() => handleNextVideo(false)}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-indigo-600/20"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              Watch Reel (&gt;1.5s Count)
            </button>
          </div>
        </div>

        {/* Floating Overlay Controls */}
        <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-neutral-200">Floating Total Pill Overlay</p>
            <p className="text-[11px] text-neutral-400">Draggable pill displaying grand total count</p>
          </div>
          <button
            onClick={onToggleOverlay}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              overlayEnabled
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-neutral-800 text-neutral-400 border-neutral-700'
            }`}
          >
            {overlayEnabled ? 'Enabled (ON)' : 'Disabled'}
          </button>
        </div>

      </div>
    </div>
  );
};
