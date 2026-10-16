import React, { useState, useMemo } from 'react';
import { PlatformType, ReelRecord } from '../types';
import { PLATFORMS } from '../data/mockSampleData';
import { 
  Database, 
  Terminal, 
  Play, 
  Search, 
  Sparkles, 
  Trash2,
  CheckCircle2
} from 'lucide-react';

interface RoomDbInspectorProps {
  records: ReelRecord[];
  onClearData: () => void;
  onSeedData: () => void;
}

export const RoomDbInspector: React.FC<RoomDbInspectorProps> = ({
  records,
  onClearData,
  onSeedData,
}) => {
  const [activeQueryTab, setActiveQueryTab] = useState<'UNIFIED_DAILY' | 'GRAND_TOTAL' | 'RAW_TABLE'>('UNIFIED_DAILY');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortAsc, setSortAsc] = useState(false);

  // SQL Query Definitions for Unified Total Counting
  const queryDefinitions = {
    UNIFIED_DAILY: {
      title: "Unified Daily Total Query (All Platforms Combined)",
      sql: `-- UNIFIED DAILY TOTAL QUERY: Groups by dateString to count ALL reels combined
SELECT 
    dateString,
    COUNT(*) AS totalReelsWatched,
    SUM(dwellTimeMs) AS totalDwellMs,
    ROUND(AVG(dwellTimeMs) / 1000.0, 1) AS avgSecondsPerReel
FROM reel_usage
WHERE timestamp >= :startTimeMillis
GROUP BY dateString
ORDER BY dateString ASC;`,
    },
    GRAND_TOTAL: {
      title: "Grand Total Query (One Single Total Count)",
      sql: `-- SINGLE GRAND TOTAL QUERY: Counts every reel viewed regardless of app
SELECT 
    COUNT(*) AS grandTotalReels,
    SUM(dwellTimeMs) AS grandTotalDwellMs,
    ROUND(SUM(dwellTimeMs) / 1000.0 / 60.0, 1) AS totalMinutesLost,
    COUNT(DISTINCT dateString) AS totalActiveDays
FROM reel_usage;`,
    },
    RAW_TABLE: {
      title: "Raw Records Log (SELECT * FROM reel_usage)",
      sql: `SELECT id, platform, timestamp, dwellTimeMs, dateString, creatorTag, audioTitle
FROM reel_usage
ORDER BY timestamp DESC
LIMIT 50;`,
    },
  };

  // Unified Daily Aggregates data computation
  const dailyUnifiedTotals = useMemo(() => {
    const map = new Map<string, { totalViews: number; totalDwellMs: number }>();
    records.forEach((r) => {
      if (!map.has(r.dateString)) {
        map.set(r.dateString, { totalViews: 0, totalDwellMs: 0 });
      }
      const item = map.get(r.dateString)!;
      item.totalViews += 1;
      item.totalDwellMs += r.dwellTimeMs;
    });

    const rows: { dateString: string; totalViews: number; totalDwellMs: number; avgSec: string }[] = [];
    map.forEach((val, dateString) => {
      rows.push({
        dateString,
        totalViews: val.totalViews,
        totalDwellMs: val.totalDwellMs,
        avgSec: val.totalViews > 0 ? (val.totalDwellMs / val.totalViews / 1000).toFixed(1) : '0',
      });
    });

    return rows.sort((a, b) => b.dateString.localeCompare(a.dateString));
  }, [records]);

  // Grand Total summary
  const grandTotalStats = useMemo(() => {
    const totalViews = records.length;
    const totalDwellMs = records.reduce((acc, curr) => acc + curr.dwellTimeMs, 0);
    const totalMinutes = (totalDwellMs / 60000).toFixed(1);
    const uniqueDays = new Set(records.map((r) => r.dateString)).size;
    const avgSec = totalViews > 0 ? (totalDwellMs / totalViews / 1000).toFixed(1) : '0';

    return {
      totalViews,
      totalDwellMs,
      totalMinutes,
      uniqueDays,
      avgSec,
    };
  }, [records]);

  // Filter raw records
  const filteredRawRecords = useMemo(() => {
    return records
      .filter((r) => {
        return !searchTerm || 
          r.platform.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (r.creatorTag && r.creatorTag.toLowerCase().includes(searchTerm.toLowerCase())) ||
          r.dateString.includes(searchTerm);
      })
      .sort((a, b) => (sortAsc ? a.timestamp - b.timestamp : b.timestamp - a.timestamp));
  }, [records, searchTerm, sortAsc]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-neutral-900 border border-neutral-800 p-5 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Room Database Inspector
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold">
                reel_tracker_database.db
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Unified counting architecture: All platforms query into one unified total count
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSeedData}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Seed Sample Data
          </button>
          <button
            onClick={onClearData}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-rose-950/40 text-neutral-400 hover:text-rose-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* SQL Query Console Box */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-neutral-900/90 px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <span>Room DAO Prepared SQL Statements (Unified Total)</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveQueryTab('UNIFIED_DAILY')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                activeQueryTab === 'UNIFIED_DAILY'
                  ? 'bg-indigo-600 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Unified Daily Totals
            </button>
            <button
              onClick={() => setActiveQueryTab('GRAND_TOTAL')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                activeQueryTab === 'GRAND_TOTAL'
                  ? 'bg-indigo-600 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Grand Total (Combined)
            </button>
            <button
              onClick={() => setActiveQueryTab('RAW_TABLE')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                activeQueryTab === 'RAW_TABLE'
                  ? 'bg-indigo-600 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Raw Entity Table
            </button>
          </div>
        </div>

        {/* Code display */}
        <div className="p-4 bg-neutral-950/90 text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed border-b border-neutral-800/60">
          <pre>{queryDefinitions[activeQueryTab].sql}</pre>
        </div>

        {/* Result Header */}
        <div className="px-4 py-2.5 bg-neutral-900/40 text-[11px] text-neutral-400 flex items-center justify-between border-b border-neutral-800/80">
          <div className="flex items-center gap-2">
            <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
            <span>
              {activeQueryTab === 'UNIFIED_DAILY' && `${dailyUnifiedTotals.length} calendar days aggregated into unified totals`}
              {activeQueryTab === 'GRAND_TOTAL' && `1 row containing unified grand total across all apps`}
              {activeQueryTab === 'RAW_TABLE' && `${filteredRawRecords.length} records returned`}
            </span>
          </div>

          {activeQueryTab === 'RAW_TABLE' && (
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Search raw records..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-neutral-900 border border-neutral-700/60 rounded-lg pl-7 pr-2.5 py-1 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          {activeQueryTab === 'UNIFIED_DAILY' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-neutral-900/80 text-neutral-400 font-mono text-[11px] sticky top-0 border-b border-neutral-800">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">dateString</th>
                  <th className="py-2.5 px-4 font-semibold text-right">totalReelsWatched (COUNT)</th>
                  <th className="py-2.5 px-4 font-semibold text-right">totalDwellMs (SUM)</th>
                  <th className="py-2.5 px-4 font-semibold text-right">avgSecondsPerReel</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Total Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-mono text-neutral-300">
                {dailyUnifiedTotals.map((row) => {
                  const minutes = (row.totalDwellMs / 60000).toFixed(1);
                  return (
                    <tr key={row.dateString} className="hover:bg-neutral-800/30 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-white">{row.dateString}</td>
                      <td className="py-2.5 px-4 text-right text-emerald-400 font-bold text-sm">
                        {row.totalViews} reels
                      </td>
                      <td className="py-2.5 px-4 text-right text-neutral-400">
                        {row.totalDwellMs.toLocaleString()} ms
                      </td>
                      <td className="py-2.5 px-4 text-right text-amber-400 font-bold">
                        {row.avgSec}s
                      </td>
                      <td className="py-2.5 px-4 text-right text-white font-semibold">
                        {minutes} mins
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {activeQueryTab === 'GRAND_TOTAL' && (
            <div className="p-6 bg-neutral-950 text-white space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
                  <span className="text-[11px] text-neutral-400 uppercase font-bold tracking-wider">
                    Grand Total Reels
                  </span>
                  <p className="text-3xl font-black text-emerald-400 mt-1">{grandTotalStats.totalViews}</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">All platforms combined</p>
                </div>
                <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
                  <span className="text-[11px] text-neutral-400 uppercase font-bold tracking-wider">
                    Total Minutes Watched
                  </span>
                  <p className="text-3xl font-black text-indigo-400 mt-1">{grandTotalStats.totalMinutes}m</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">{grandTotalStats.totalDwellMs.toLocaleString()} ms</p>
                </div>
                <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
                  <span className="text-[11px] text-neutral-400 uppercase font-bold tracking-wider">
                    Avg Seconds / Reel
                  </span>
                  <p className="text-3xl font-black text-amber-400 mt-1">{grandTotalStats.avgSec}s</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">&gt;1.5s qualified</p>
                </div>
                <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
                  <span className="text-[11px] text-neutral-400 uppercase font-bold tracking-wider">
                    Active Days Logged
                  </span>
                  <p className="text-3xl font-black text-white mt-1">{grandTotalStats.uniqueDays}</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">Calendar days</p>
                </div>
              </div>
            </div>
          )}

          {activeQueryTab === 'RAW_TABLE' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-neutral-900/80 text-neutral-400 font-mono text-[11px] sticky top-0 border-b border-neutral-800">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">id</th>
                  <th className="py-2.5 px-4 font-semibold">platform</th>
                  <th className="py-2.5 px-4 font-semibold">timestamp</th>
                  <th className="py-2.5 px-4 font-semibold">dateString</th>
                  <th className="py-2.5 px-4 font-semibold text-right">dwellTimeMs</th>
                  <th className="py-2.5 px-4 font-semibold">creatorTag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-mono text-neutral-300">
                {filteredRawRecords.slice(0, 80).map((r) => {
                  const pConfig = PLATFORMS[r.platform];
                  return (
                    <tr key={r.id} className="hover:bg-neutral-800/30 transition-colors">
                      <td className="py-2 px-4 text-neutral-500">{r.id}</td>
                      <td className="py-2 px-4">
                        <span 
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                          style={{ backgroundColor: `${pConfig?.brandColor || '#999'}20`, color: pConfig?.brandColor || '#ccc' }}
                        >
                          {r.platform}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-neutral-400">{new Date(r.timestamp).toLocaleTimeString()}</td>
                      <td className="py-2 px-4 text-neutral-300">{r.dateString}</td>
                      <td className="py-2 px-4 text-right text-amber-400 font-bold">{(r.dwellTimeMs / 1000).toFixed(1)}s</td>
                      <td className="py-2 px-4 text-neutral-400 truncate max-w-[140px]">{r.creatorTag || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
