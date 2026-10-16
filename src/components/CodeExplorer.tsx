import React, { useState } from 'react';
import { KOTLIN_CODEBASE, CodeFile } from '../data/kotlinCodebase';
import { 
  FolderTree, 
  FileCode, 
  Copy, 
  Check, 
  FileCheck,
  Search,
  ExternalLink,
  ChevronRight,
  Sparkles
} from 'lucide-react';

export const CodeExplorer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<CodeFile>(KOTLIN_CODEBASE[0]);
  const [copied, setCopied] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const categories = ['ALL', 'Service', 'Detection', 'Overlay', 'Database', 'Compose UI', 'Manifest & Config'];

  const filteredFiles = KOTLIN_CODEBASE.filter((file) => {
    const matchesCategory = selectedCategory === 'ALL' || file.category === selectedCategory;
    const matchesSearch = !searchFilter || 
      file.filename.toLowerCase().includes(searchFilter.toLowerCase()) ||
      file.path.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-neutral-900 border border-neutral-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white">Android Studio Architecture Explorer</h2>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded font-mono font-bold">
              Kotlin 2.0 • Compose M3 • Room 2.6
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Complete, pristine, production-ready deliverables ready to paste into Android Studio
          </p>
        </div>

        <button
          onClick={handleCopy}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-md ${
            copied
              ? 'bg-emerald-600 text-white shadow-emerald-600/20'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Copied Active File!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Active File</span>
            </>
          )}
        </button>
      </div>

      {/* Main IDE-style Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl min-h-[640px]">
        
        {/* Left Sidebar: File Tree & Categories */}
        <div className="lg:col-span-4 bg-neutral-900/60 border-r border-neutral-800 flex flex-col justify-between">
          <div>
            {/* Search and Category Filter */}
            <div className="p-3 border-b border-neutral-800 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search file name..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700/60 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Categories */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-1 rounded text-[10px] font-semibold whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? 'bg-indigo-600 text-white'
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* File List */}
            <div className="p-2 space-y-1 overflow-y-auto max-h-[500px]">
              {filteredFiles.map((file) => {
                const isSelected = selectedFile.filename === file.filename;
                const isXml = file.language === 'xml';
                const isGradle = file.language === 'groovy';

                return (
                  <button
                    key={file.filename}
                    onClick={() => setSelectedFile(file)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 ${
                      isSelected
                        ? 'bg-neutral-800/90 border border-indigo-500/50 text-white shadow-sm'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 border border-transparent'
                    }`}
                  >
                    <div className="mt-0.5">
                      <FileCode className={`w-4 h-4 ${
                        isXml ? 'text-amber-400' : isGradle ? 'text-teal-400' : 'text-indigo-400'
                      }`} />
                    </div>
                    <div className="flex-1 truncate">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold truncate text-white">{file.filename}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-950 text-neutral-400 font-mono">
                          {file.category}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-500 truncate mt-0.5 font-mono">
                        {file.path}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom stats */}
          <div className="p-3 border-t border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between">
            <span>{KOTLIN_CODEBASE.length} Architecture Files</span>
            <span className="font-mono text-emerald-400">100% Production Ready</span>
          </div>
        </div>

        {/* Right Editor: Code Content */}
        <div className="lg:col-span-8 flex flex-col justify-between bg-neutral-950">
          <div>
            {/* File Header Bar */}
            <div className="bg-neutral-900/90 px-4 py-3 border-b border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate">
                <FileCode className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="text-xs font-mono font-bold text-white truncate">
                  {selectedFile.path}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleCopy}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Code
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Description Callout */}
            <div className="px-4 py-2 bg-neutral-900/40 border-b border-neutral-800/80 text-xs text-neutral-400">
              <span className="font-semibold text-neutral-300">File Purpose:</span> {selectedFile.description}
            </div>

            {/* Code Preformatted Area */}
            <div className="p-4 overflow-x-auto max-h-[550px] overflow-y-auto font-mono text-xs text-neutral-200 leading-relaxed selection:bg-indigo-700 selection:text-white">
              <pre>
                <code>{selectedFile.content}</code>
              </pre>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
