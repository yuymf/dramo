/**
 * Version management panel
 * Display version history, diff view, and rollback functionality
 */
"use client";
import { useState } from "react";
import type { ScriptVersion } from "@/lib/storage/local";

interface VersionPanelProps {
  versions: ScriptVersion[];
  currentSnapshot: unknown;
  onRollback: (versionId: string, snapshot: unknown) => void;
  onSaveVersion: (description: string) => void;
  onClose: () => void;
}

export function VersionPanel({
  versions,
  currentSnapshot: _currentSnapshot,
  onRollback,
  onSaveVersion,
  onClose,
}: VersionPanelProps) {
  void _currentSnapshot;
  const [description, setDescription] = useState("");
  const [selectedVersion, setSelectedVersion] = useState<ScriptVersion | null>(
    null
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">Version History</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Save New Version */}
        <div className="border-b p-4 bg-slate-50">
          <h3 className="text-sm font-medium mb-2">Save Current as New Version</h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Version description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex-1 px-3 py-2 rounded border border-slate-300 text-sm"
            />
            <button
              onClick={() => {
                onSaveVersion(description);
                setDescription("");
              }}
              className="px-4 py-2 rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-all duration-200"
            >
              Save
            </button>
          </div>
        </div>

        {/* Version List */}
        <div className="flex-1 overflow-auto p-4 space-y-2">
          {versions.length === 0 && (
            <p className="text-sm text-slate-400 italic">
              No versions saved yet. Save your first version above.
            </p>
          )}
          {versions
            .slice()
            .reverse()
            .map((version) => (
              <div
                key={version.id}
                onClick={() => setSelectedVersion(version)}
                className={`p-3 rounded border cursor-pointer transition-all duration-200 ${
                  selectedVersion?.id === version.id
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        Version {version.versionNumber}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(version.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {version.description && (
                      <p className="text-sm text-slate-600">
                        {version.description}
                      </p>
                    )}
                  </div>
                  {selectedVersion?.id === version.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRollback(version.id, version.snapshot);
                      }}
                      className="px-3 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200"
                    >
                      Rollback
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>

        {/* Footer */}
        <div className="border-t p-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 transition-all duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

