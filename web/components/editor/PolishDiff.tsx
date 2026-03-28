/**
 * Polish diff view modal
 * Compare original and polished text with apply/discard actions
 */
"use client";

interface PolishDiffProps {
  original: string;
  polished: string;
  explanation?: string;
  onApply: (polishedText: string) => void;
  onDiscard: () => void;
}

export function PolishDiff({
  original,
  polished,
  explanation,
  onApply,
  onDiscard,
}: PolishDiffProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">Text Polish Preview</h2>
          <button
            onClick={onDiscard}
            className="text-slate-500 hover:text-slate-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body - Diff View */}
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Original */}
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-2">
                Original
              </h3>
              <div className="p-3 bg-red-50 border border-red-200 rounded min-h-[100px]">
                <p className="text-sm leading-relaxed text-red-800 line-through">
                  {original}
                </p>
              </div>
            </div>

            {/* Polished */}
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-2">
                Polished
              </h3>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded min-h-[100px]">
                <p className="text-sm leading-relaxed text-emerald-800">
                  {polished}
                </p>
              </div>
            </div>
          </div>

          {/* Explanation */}
          {explanation && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <h4 className="text-sm font-medium text-blue-700 mb-1">
                💡 Explanation
              </h4>
              <p className="text-sm text-blue-600">{explanation}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t p-4 flex items-center gap-3">
          <button
            onClick={() => onApply(polished)}
            className="px-4 py-2 rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-all duration-200"
          >
            Apply Changes
          </button>
          <button
            onClick={onDiscard}
            className="px-4 py-2 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 transition-all duration-200"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}

