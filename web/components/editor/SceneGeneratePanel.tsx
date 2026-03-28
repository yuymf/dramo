/**
 * Scene generation candidate panel
 * Displays multiple AI-generated candidates with insert/replace actions
 */
"use client";
import { useState } from "react";

interface Candidate {
  id: string;
  text: string;
  rank: number;
}

interface SceneGeneratePanelProps {
  candidates: Candidate[];
  onInsert: (candidateId: string, text: string) => void;
  onReplace: (candidateId: string, text: string) => void;
  onClose: () => void;
}

export function SceneGeneratePanel({
  candidates,
  onInsert,
  onReplace,
  onClose,
}: SceneGeneratePanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    candidates[0]?.id || null
  );

  const selectedCandidate = candidates.find((c) => c.id === selectedId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">AI Generation Candidates</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {candidates.map((candidate) => (
            <div
              key={candidate.id}
              onClick={() => setSelectedId(candidate.id)}
              className={`p-3 rounded border cursor-pointer transition-all duration-200 ${
                selectedId === candidate.id
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <div className="flex items-start gap-2">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${
                    candidate.rank === 1
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  #{candidate.rank}
                </span>
                <p className="flex-1 text-sm leading-relaxed">{candidate.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="border-t p-4 flex items-center gap-3">
          <button
            onClick={() =>
              selectedCandidate &&
              onInsert(selectedCandidate.id, selectedCandidate.text)
            }
            disabled={!selectedId}
            className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            Insert Below
          </button>
          <button
            onClick={() =>
              selectedCandidate &&
              onReplace(selectedCandidate.id, selectedCandidate.text)
            }
            disabled={!selectedId}
            className="px-4 py-2 rounded bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            Replace Current
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 transition-all duration-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

