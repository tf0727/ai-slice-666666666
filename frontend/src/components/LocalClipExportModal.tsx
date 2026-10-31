import { useMemo, useRef, useState } from 'react';

import { formatFileSize } from '../services/audioExtractor';
import type { LocalClipExportProgress } from '../services/videoClipExporter';
import { evaluateVideoSelection } from '../utils/videoFileMatch';

interface LocalClipExportModalProps {
  taskFilename: string;
  clipCount: number;
  exporting: boolean;
  exportMessage: string;
  progress: LocalClipExportProgress | null;
  onClose: () => void;
  onConfirm: (file: File) => Promise<void>;
  onCancelExport: () => void;
}

export default function LocalClipExportModal({
  taskFilename,
  clipCount,
  exporting,
  exportMessage,
  progress,
  onClose,
  onConfirm,
  onCancelExport,
}: LocalClipExportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectionResult = useMemo(() => {
    if (!selectedFile) return null;
    return evaluateVideoSelection({
      taskFilename,
      fileName: selectedFile.name,
      mimeType: selectedFile.type,
      sizeBytes: selectedFile.size,
    });
  }, [selectedFile, taskFilename]);

  const handleSelect = (file: File | null) => {
    if (!file || exporting) return;
    setSelectedFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleSelect(event.dataTransfer.files?.[0] ?? null);
  };

  const canStart = !!selectedFile && selectionResult?.isVideoLike;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={() => !exporting && onClose()}
    >
      <div
        className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-[520px] max-w-[92vw] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-1">✂️ 一键切片</h3>
        <p className="text-sm text-slate-400 mb-4">
          选择本任务对应的原视频文件，浏览器会在本地完成 {clipCount} 段切片，不会重新上传整段视频。
        </p>

        <div
          className={`rounded-2xl border-2 border-dashed transition-all duration-200 p-5 mb-4 cursor-pointer ${
            isDragging
              ? 'border-violet-500 bg-violet-500/10'
              : 'border-slate-600 bg-slate-900/70 hover:border-slate-500'
          } ${exporting ? 'pointer-events-none opacity-70' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            if (!exporting) setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragging(false);
          }}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,.mkv,.flv,.avi,.wmv,.ts,.m4v"
            className="hidden"
            disabled={exporting}
            onChange={(event) => handleSelect(event.target.files?.[0] ?? null)}
          />

          {selectedFile ? (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white break-all">{selectedFile.name}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {formatFileSize(selectedFile.size)}
                    {selectionResult?.isLikelyMatch ? ' · 与当前任务匹配' : ''}
                  </p>
                </div>
                {!exporting && (
                  <button
                    type="button"
                    className="shrink-0 px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                    onClick={(event) => {
                      event.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    重新选择
                  </button>
                )}
              </div>

              {selectionResult?.warning && (
                <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  {selectionResult.warning}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-3">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-sm font-medium text-white">点击选择或拖入原视频文件</p>
              <p className="text-xs text-slate-400 mt-2">
                建议选择与任务文件名相同的原视频：<span className="text-violet-300 break-all">{taskFilename}</span>
              </p>
            </div>
          )}
        </div>

        {progress && (
          <div className="mb-4 rounded-xl bg-slate-900/80 border border-slate-700 px-4 py-3">
            <p className="text-sm text-violet-300">{progress.message}</p>
            <p className="text-xs text-slate-400 mt-1">
              {progress.stage === 'clipping'
                ? `阶段：本地切片 · ${progress.currentClip}/${progress.totalClips}`
                : progress.stage === 'zipping'
                  ? '阶段：打包 ZIP'
                  : progress.stage === 'done'
                    ? '阶段：准备下载'
                    : progress.stage === 'reading'
                      ? '阶段：读取视频'
                      : '阶段：加载引擎'}
            </p>
          </div>
        )}

        {exportMessage && (
          <p className="text-xs text-slate-300 bg-slate-900/70 border border-slate-700 rounded-lg px-3 py-2 mb-4">
            {exportMessage}
          </p>
        )}

        <div className="flex gap-3 justify-end">
          {exporting ? (
            <button
              type="button"
              onClick={onCancelExport}
              className="px-4 py-2 text-sm text-amber-300 hover:text-amber-200 transition-colors"
            >
              取消切片
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              关闭
            </button>
          )}

          <button
            type="button"
            disabled={!canStart || exporting}
            onClick={async () => {
              if (!selectedFile) return;
              await onConfirm(selectedFile);
            }}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {exporting ? '切片中...' : '开始切片'}
          </button>
        </div>
      </div>
    </div>
  );
}
