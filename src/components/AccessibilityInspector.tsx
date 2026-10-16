import React, { useState } from 'react';
import { AccessibilityLogEvent, PlatformType } from '../types';
import { PLATFORMS } from '../data/mockSampleData';
import { 
  Activity, 
  Terminal, 
  Clock, 
  Layers, 
  CheckCircle, 
  AlertCircle, 
  ShieldCheck, 
  Code2,
  Trash2,
  Zap,
  Info
} from 'lucide-react';

interface AccessibilityInspectorProps {
  logs: AccessibilityLogEvent[];
  onClearLogs: () => void;
  currentPlatform: PlatformType;
}

export const AccessibilityInspector: React.FC<AccessibilityInspectorProps> = ({
  logs,
  onClearLogs,
  currentPlatform,
}) => {
  const [selectedEventType, setSelectedEventType] = useState<string>('ALL');
  const platform = PLATFORMS[currentPlatform];

  const filteredLogs = logs.filter((log) => {
    if (selectedEventType === 'ALL') return true;
    return log.eventType === selectedEventType;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-neutral-900 border border-neutral-800 p-5 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              AccessibilityService Event Stream
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold">
                ACTIVE
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Real-time monitoring of <code className="text-neutral-300">TYPE_VIEW_SCROLLED</code> and debounce dwell triggers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedEventType}
            onChange={(e) => setSelectedEventType(e.target.value)}
            className="bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
          >
            <option value="ALL">All Event Types</option>
            <option value="TYPE_VIEW_SCROLLED">TYPE_VIEW_SCROLLED</option>
            <option value="TYPE_WINDOW_STATE_CHANGED">TYPE_WINDOW_STATE_CHANGED</option>
            <option value="TYPE_WINDOW_CONTENT_CHANGED">TYPE_WINDOW_CONTENT_CHANGED</option>
          </select>
          <button
            onClick={onClearLogs}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-xl transition-colors"
            title="Clear Event Log"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Real-time Event Log Console */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-neutral-900/90 px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>android.view.accessibility.AccessibilityEvent Stream</span>
          </div>
          <span className="text-xs font-mono text-neutral-500">
            {filteredLogs.length} events captured
          </span>
        </div>

        <div className="divide-y divide-neutral-800/60 max-h-96 overflow-y-auto font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">
              No events captured yet. Swipe reels on the simulated phone to generate AccessibilityEvents!
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isCounted = log.dwellStatus === 'COUNTED';
              const isDiscarded = log.dwellStatus === 'DISCARDED_FAST_SWIPE';
              const isDwelling = log.dwellStatus === 'DWELLING';

              return (
                <div 
                  key={log.id} 
                  className={`p-3.5 flex items-start gap-3 transition-colors ${
                    isCounted 
                      ? 'bg-emerald-950/20' 
                      : isDiscarded 
                      ? 'bg-amber-950/20' 
                      : 'hover:bg-neutral-900/30'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isCounted ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : isDiscarded ? (
                      <Zap className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Activity className="w-4 h-4 text-indigo-400" />
                    )}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="text-neutral-500">{log.timestamp}</span>
                      <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-bold">
                        {log.eventType}
                      </span>
                      <span className="text-indigo-400 truncate">{log.packageName}</span>
                      {isCounted && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-[10px]">
                          QUALIFIED WATCH (&gt;1.5s)
                        </span>
                      )}
                      {isDiscarded && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-[10px]">
                          FAST SWIPE DISCARDED
                        </span>
                      )}
                      {isDwelling && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold text-[10px] animate-pulse">
                          VERIFYING DWELL...
                        </span>
                      )}
                    </div>
                    <p className={`text-xs ${
                      isCounted 
                        ? 'text-emerald-300 font-semibold' 
                        : isDiscarded 
                        ? 'text-amber-300' 
                        : 'text-neutral-300'
                    }`}>
                      {log.message}
                    </p>
                    {log.nodeSignature && (
                      <p className="text-[10px] text-neutral-500 font-mono">
                        Signature Hash: {log.nodeSignature}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Accessibility Node Tree Inspection Guide */}
      <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          Accessibility Node Tree Heuristic Signatures ({platform.name})
        </h3>
        <p className="text-xs text-neutral-400 leading-relaxed">
          How <code className="text-neutral-300 font-mono">ReelDetector.kt</code> avoids brittle obfuscated resource IDs (like <code className="text-neutral-400">R.id.clips_viewer</code>) that break on every app update:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2">
            <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              1. Vertical Pager & Fullscreen Bounds
            </span>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Detects vertical <code className="text-neutral-300">androidx.viewpager2.widget.ViewPager2</code> or <code className="text-neutral-300">RecyclerView</code> whose screen bounds occupy 100% of viewport height (<code className="text-neutral-300">bounds.height() == screenHeight</code>). Standard feeds feature top navigation bars and horizontal carousel pagers.
            </p>
          </div>

          <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2">
            <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              2. Right-Edge Action Button Column
            </span>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Inspects child nodes where <code className="text-neutral-300">bounds.left &gt; 78% of screen width</code> and <code className="text-neutral-300">isClickable == true</code>. Finds semantic content descriptions matching "like", "comment", "share", and rotating audio disc.
            </p>
          </div>

          <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2">
            <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              3. Semantic Content-Description Clues
            </span>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Extracts strings like "Reel by [creator]", "Original audio", "Like this short", or "remix this video". These accessibility strings are internationalized and rarely removed by obfuscators.
            </p>
          </div>

          <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2">
            <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              4. 1500ms Debounce Coroutine Dwell
            </span>
            <p className="text-xs text-neutral-400 leading-relaxed">
              A <code className="text-neutral-300">kotlinx.coroutines.Job</code> starts with <code className="text-neutral-300">delay(1500L)</code>. If the user scrolls before 1.5 seconds elapse, the job is cancelled immediately without polluting the database.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
