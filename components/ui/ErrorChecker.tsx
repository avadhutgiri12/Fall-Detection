"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./Card";
import { CanvasButton } from "./CanvasButton";
import { Input } from "./Input";
import { ErrorEntry, ErrorSource, ErrorSeverity } from "../hooks/useErrorTracker";

interface ErrorCheckerProps {
  errors: ErrorEntry[];
  onClear: () => void;
  onResolve: (id: string) => void;
  onCopy: (id: string) => Promise<boolean>;
  onExport: () => void;
  filterSources?: ErrorSource[];
  maxHeight?: string;
  title?: string;
  showFilter?: boolean;
  showExport?: boolean;
}

const SEVERITY_COLORS: Record<ErrorSeverity, { bg: string; text: string; border: string; icon: string }> = {
  info: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800", icon: "ℹ️" },
  warning: { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800", icon: "⚠️" },
  error: { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-400", border: "border-red-200 dark:border-red-800", icon: "❌" },
  critical: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-800 dark:text-red-300", border: "border-red-300 dark:border-red-700", icon: "🔴" },
};

const SOURCE_LABELS: Record<ErrorSource, string> = {
  websocket: "WebSocket",
  camera: "Camera",
  "video-upload": "Video Upload",
  detection: "Detection",
  network: "Network",
  backend: "Backend",
  unknown: "Unknown",
};

const SOURCE_COLORS: Record<ErrorSource, string> = {
  websocket: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  camera: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "video-upload": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  detection: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  network: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  backend: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  unknown: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 1000) return "just now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function ErrorChecker({
  errors,
  onClear,
  onResolve,
  onCopy,
  onExport,
  filterSources,
  maxHeight = "400px",
  title = "Error Debugger",
  showFilter = true,
  showExport = true,
}: ErrorCheckerProps) {
  const [filterSource, setFilterSource] = useState<ErrorSource | "all">("all");
  const [filterSeverity, setFilterSeverity] = useState<ErrorSeverity | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Get unique sources from errors
  const availableSources = useMemo(() => {
    const sources = new Set(errors.map(e => e.source));
    return Array.from(sources).sort();
  }, [errors]);

  // Filter errors
  const filteredErrors = useMemo(() => {
    return errors.filter(error => {
      if (filterSource !== "all" && error.source !== filterSource) return false;
      if (filterSeverity !== "all" && error.severity !== filterSeverity) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!error.message.toLowerCase().includes(query) &&
            !JSON.stringify(error.details || {}).toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [errors, filterSource, filterSeverity, searchQuery]);

  const unresolvedCount = errors.filter(e => !e.resolved).length;

  const handleToggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const handleCopy = async (id: string) => {
    const success = await onCopy(id);
    // Could show a toast here, but we don't have access to toast in this component
    // The parent component should handle notifications
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg">{title}</CardTitle>
          {unresolvedCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
              {unresolvedCount} unresolved
            </span>
          )}
          <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full">
            {errors.length} total
          </span>
        </div>
        <div className="flex items-center gap-2">
          {showExport && (
            <CanvasButton variant="ghost" size="sm" onClick={onExport}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export
            </CanvasButton>
          )}
          <CanvasButton variant="ghost" size="sm" onClick={onClear}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Clear
          </CanvasButton>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Filter Bar */}
        {showFilter && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input
                type="text"
                placeholder="Search errors..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 min-w-[200px] text-sm"
                aria-label="Search errors"
              />
              <select
                value={filterSource}
                onChange={e => setFilterSource(e.target.value as ErrorSource | "all")}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                aria-label="Filter by source"
              >
                <option value="all">All Sources</option>
                {availableSources.map(source => (
                  <option key={source} value={source}>{SOURCE_LABELS[source]}</option>
                ))}
              </select>
              <select
                value={filterSeverity}
                onChange={e => setFilterSeverity(e.target.value as ErrorSeverity | "all")}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                aria-label="Filter by severity"
              >
                <option value="all">All Severities</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="critical">Critical</option>
              </select>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={e => setAutoScroll(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                Auto-scroll
              </label>
            </div>
          </div>
        )}

        {/* Error List */}
        <div
          className="max-h-[400px] overflow-y-auto"
          style={{ maxHeight }}
          role="log"
          aria-live="polite"
          aria-label="Error log"
        >
          {filteredErrors.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-50" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <p className="text-sm">{errors.length === 0 ? "No errors recorded" : "No errors match current filters"}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredErrors.map((error) => {
                const severityStyle = SEVERITY_COLORS[error.severity];
                const sourceStyle = SOURCE_COLORS[error.source];
                const isExpanded = expandedId === error.id;

                return (
                  <div
                    key={error.id}
                    className={`${severityStyle.bg} ${severityStyle.border} transition-colors ${error.resolved ? "opacity-60" : ""}`}
                  >
                    {/* Error Summary Row */}
                    <div className="p-3 flex items-start gap-3" onClick={() => handleToggleExpand(error.id)}>
                      <span className={`flex-shrink-0 text-lg`} aria-hidden="true">
                        {severityStyle.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-medium ${severityStyle.text}`}>
                            {error.message}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${sourceStyle}`}>
                            {SOURCE_LABELS[error.source]}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400`}>
                            {error.severity.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {formatRelativeTime(error.timestamp)}
                          </span>
                          {error.resolved && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                              Resolved
                            </span>
                          )}
                        </div>
                        {error.details && Object.keys(error.details).length > 0 && !isExpanded && (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate font-mono">
                            {JSON.stringify(error.details)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <CanvasButton
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleCopy(error.id); }}
                          aria-label="Copy error details"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </CanvasButton>
                        <CanvasButton
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); onResolve(error.id); }}
                          disabled={error.resolved}
                          aria-label={error.resolved ? "Already resolved" : "Mark as resolved"}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </CanvasButton>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleExpand(error.id); }}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          aria-label={isExpanded ? "Collapse" : "Expand"}
                          aria-expanded={isExpanded}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
                        <div className="grid gap-3 text-sm">
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">Timestamp: </span>
                            <span className="font-mono text-gray-900 dark:text-white">{formatTimestamp(error.timestamp)}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">ID: </span>
                            <span className="font-mono text-gray-900 dark:text-white">{error.id}</span>
                          </div>
                          {error.details && Object.keys(error.details).length > 0 && (
                            <div>
                              <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">Details:</div>
                              <pre className="p-3 bg-white dark:bg-gray-800 rounded text-xs overflow-x-auto font-mono text-gray-900 dark:text-gray-100">
                                {JSON.stringify(error.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ErrorChecker;