import React, { useState } from 'react';
import { HermesFile, HermesFileCategory } from '@hermes-hub/types';
import { formatBytes, formatTimeAgo } from '@hermes-hub/shared';
import {
  FolderSync,
  Search,
  Copy,
  Check,
  FileCode,
  FileText,
  FileSpreadsheet,
  Terminal,
  Laptop,
  CheckCircle2,
} from 'lucide-react';

interface FilesViewProps {
  files: HermesFile[];
}

const CATEGORIES: (HermesFileCategory | 'All')[] = [
  'All',
  'Configuration',
  'Memories',
  'Skills',
  'Sessions/Exports',
  'Logs',
];

export const FilesView: React.FC<FilesViewProps> = ({ files }) => {
  const [selectedCategory, setSelectedCategory] = useState<HermesFileCategory | 'All'>('All');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredFiles = files.filter((f) => {
    const matchesCategory = selectedCategory === 'All' || f.category === selectedCategory;
    const matchesSearch =
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.path.toLowerCase().includes(search.toLowerCase()) ||
      f.sha256.includes(search);
    return matchesCategory && matchesSearch;
  });

  const handleCopyPath = (file: HermesFile) => {
    navigator.clipboard.writeText(file.path);
    setCopiedId(file.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Category Pills & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search files or hashes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-card border border-border text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Files Table */}
      <div className="rounded-2xl border border-border bg-card/70 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold">
              <tr>
                <th className="py-3 px-4">File Name & Path</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">SHA-256 Digest</th>
                <th className="py-3 px-4">Origin & Rev</th>
                <th className="py-3 px-4">Modified</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredFiles.map((file) => (
                <tr key={file.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-foreground">{file.name}</div>
                    <div className="text-[11px] font-mono text-muted-foreground truncate max-w-xs">
                      {file.path}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium text-foreground">
                      {file.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-muted-foreground">
                    {formatBytes(file.size)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-[11px] text-muted-foreground truncate block max-w-[120px]">
                      {file.sha256}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-foreground font-medium">{file.originDeviceName}</span>
                      <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary font-mono text-[10px]">
                        #{file.revision}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                    {formatTimeAgo(file.modifiedAt)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleCopyPath(file)}
                      className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy absolute file path"
                    >
                      {copiedId === file.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
