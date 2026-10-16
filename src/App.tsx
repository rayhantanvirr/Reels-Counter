/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PlatformType, ReelRecord, AccessibilityLogEvent } from './types';
import { generateSeedData } from './data/mockSampleData';
import { PhoneSimulator } from './components/PhoneSimulator';
import { ComposeDashboard } from './components/ComposeDashboard';
import { CodeExplorer } from './components/CodeExplorer';
import { RoomDbInspector } from './components/RoomDbInspector';
import { AccessibilityInspector } from './components/AccessibilityInspector';
import { AndroidRestrictionsGuide } from './components/AndroidRestrictionsGuide';
import { 
  Smartphone, 
  LayoutDashboard, 
  FolderGit2, 
  Database, 
  Activity, 
  ShieldAlert, 
  Flame,
  CheckCircle2,
  ExternalLink,
  Code
} from 'lucide-react';

type TabType = 'SIMULATOR' | 'DASHBOARD' | 'CODEBASE' | 'ROOM_DB' | 'ACCESSIBILITY' | 'OS_RESTRICTIONS';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('SIMULATOR');
  const [currentPlatform, setCurrentPlatform] = useState<PlatformType>('INSTAGRAM');
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  
  // Real-time and persistent records
  const [records, setRecords] = useState<ReelRecord[]>(() => generateSeedData());
  const [accessibilityLogs, setAccessibilityLogs] = useState<AccessibilityLogEvent[]>([]);
  
  // Live session statistics
  const [sessionReels, setSessionReels] = useState(0);
  const [sessionSeconds, setSessionSeconds] = useState(0);

  // Live session ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleNewReelLogged = (newRecord: ReelRecord) => {
    setRecords((prev) => [newRecord, ...prev]);
    setSessionReels((prev) => prev + 1);
  };

  const handleAccessibilityLog = (event: AccessibilityLogEvent) => {
    setAccessibilityLogs((prev) => [event, ...prev.slice(0, 75)]);
  };

  const handleClearData = () => {
    setRecords([]);
    setSessionReels(0);
  };

  const handleSeedData = () => {
    setRecords(generateSeedData());
  };

  const handleClearLogs = () => {
    setAccessibilityLogs([]);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-indigo-600 selection:text-white flex flex-col">
      {/* Top Application Header */}
      <header className="sticky top-0 z-50 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800/80 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-pink-600 to-amber-500 p-0.5 shadow-lg shadow-indigo-600/20">
              <div className="w-full h-full bg-neutral-950 rounded-[10px] flex items-center justify-center">
                <Flame className="w-5 h-5 text-pink-500 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-extrabold tracking-tight text-white">
                  Reel &amp; Shorts Usage Tracker
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-neutral-800 text-neutral-300 rounded border border-neutral-700">
                  Android Architecture &amp; Simulator
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Instagram • TikTok • YouTube Shorts • Facebook Reels
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-neutral-900 p-1 rounded-xl border border-neutral-800 overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab('SIMULATOR')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'SIMULATOR'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Live Phone &amp; Overlay
            </button>

            <button
              onClick={() => setActiveTab('DASHBOARD')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'DASHBOARD'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Unified Dashboard
            </button>

            <button
              onClick={() => setActiveTab('ROOM_DB')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'ROOM_DB'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              Room DB ({records.length})
            </button>

            <button
              onClick={() => setActiveTab('ACCESSIBILITY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'ACCESSIBILITY'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Event Stream
            </button>

            <button
              onClick={() => setActiveTab('CODEBASE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'CODEBASE'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              Kotlin Codebase
            </button>

            <button
              onClick={() => setActiveTab('OS_RESTRICTIONS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'OS_RESTRICTIONS'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              Android 13/14+ Guide
            </button>
          </nav>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'SIMULATOR' && (
          <div className="space-y-6">
            <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-neutral-300">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span>
                  <strong>Unified Counter Mode:</strong> Launch any app on the phone (Instagram, TikTok, YouTube, Facebook). When you watch a reel (&gt;1.5s dwell), it adds directly to <strong>one continuous total count</strong>!
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px] text-neutral-400 shrink-0">
                <span>Grand Total: <strong className="text-white">#{sessionReels}</strong></span>
                <span>DB Rows: <strong className="text-emerald-400">{records.length}</strong></span>
              </div>
            </div>

            <PhoneSimulator
              currentPlatform={currentPlatform}
              onChangePlatform={setCurrentPlatform}
              onNewReelLogged={handleNewReelLogged}
              onAccessibilityLog={handleAccessibilityLog}
              overlayEnabled={overlayEnabled}
              onToggleOverlay={() => setOverlayEnabled((prev) => !prev)}
              totalSessionReels={sessionReels}
              sessionDurationSeconds={sessionSeconds}
            />
          </div>
        )}

        {activeTab === 'DASHBOARD' && (
          <ComposeDashboard
            records={records}
            onClearData={handleClearData}
            onSeedData={handleSeedData}
          />
        )}

        {activeTab === 'ROOM_DB' && (
          <RoomDbInspector
            records={records}
            onClearData={handleClearData}
            onSeedData={handleSeedData}
          />
        )}

        {activeTab === 'ACCESSIBILITY' && (
          <AccessibilityInspector
            logs={accessibilityLogs}
            onClearLogs={handleClearLogs}
            currentPlatform={currentPlatform}
          />
        )}

        {activeTab === 'CODEBASE' && (
          <CodeExplorer />
        )}

        {activeTab === 'OS_RESTRICTIONS' && (
          <AndroidRestrictionsGuide />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800/80 bg-neutral-950 py-4 px-6 text-center text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Reel &amp; Shorts Usage Tracker • Kotlin, AccessibilityService, SYSTEM_ALERT_WINDOW &amp; Jetpack Compose
          </span>
          <span className="font-mono text-[11px]">
            Targeting API 35 (Android 15) • Compatible with API 26+
          </span>
        </div>
      </footer>
    </div>
  );
}
