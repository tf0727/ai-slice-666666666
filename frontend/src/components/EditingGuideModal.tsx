import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { EditingGuide } from '../types/task';

interface EditingGuideModalProps {
  guide: EditingGuide;
  clipTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

export default function EditingGuideModal({
  guide,
  clipTitle,
  isOpen,
  onClose,
  onRegenerate,
  isRegenerating,
}: EditingGuideModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* 弹窗主体 */}
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-cyan-500/10 flex flex-col overflow-hidden animate-in">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <span className="text-lg">🎬</span>
            <div className="overflow-hidden">
              <h3 className="text-base font-bold text-white truncate">剪辑思路</h3>
              <p className="text-xs text-slate-400 truncate mt-0.5">{clipTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="text-xs text-slate-400 hover:text-cyan-300 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 disabled:opacity-50"
            >
              {isRegenerating ? (
                <>
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  生成中
                </>
              ) : (
                <>🔄 重新生成</>
              )}
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 内容 - 可滚动 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 custom-scrollbar">
          {/* ✨ 特效时间点 */}
          {guide.special_effects?.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-sm">✨</span>
                特效时间点
              </h4>
              <div className="space-y-2.5">
                {guide.special_effects.map((fx, i) => (
                  <div key={i} className="flex items-start gap-3 bg-slate-800/50 rounded-xl p-3 border border-slate-700/50 hover:border-cyan-500/20 transition-colors">
                    <span className="font-mono text-sm text-cyan-300 bg-cyan-500/15 px-2.5 py-1 rounded-lg shrink-0 border border-cyan-500/20 font-bold">
                      {fx.time_point}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">{fx.effect}</div>
                      {fx.reason && (
                        <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">{fx.reason}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 🎵 配乐推荐 */}
          {guide.music && (
            <section>
              <h4 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-sm">🎵</span>
                配乐推荐
              </h4>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <p className="text-sm text-slate-300 leading-relaxed">{guide.music}</p>
              </div>
            </section>
          )}

          {/* 💬 字幕 & 贴纸 */}
          {guide.subtitles?.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-sm">💬</span>
                字幕 & 贴纸
              </h4>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <ul className="space-y-2">
                  {guide.subtitles.map((tip, i) => (
                    <li key={i} className="text-sm text-slate-300 flex items-start gap-2.5 leading-relaxed">
                      <span className="text-cyan-400/60 shrink-0 mt-1 text-xs">●</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* ⚡ 节奏控制 */}
          {guide.rhythm && (
            <section>
              <h4 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-sm">⚡</span>
                节奏控制
              </h4>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <p className="text-sm text-slate-300 leading-relaxed">{guide.rhythm}</p>
              </div>
            </section>
          )}

          {/* 📸 封面截取 */}
          {guide.cover && (
            <section>
              <h4 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-sm">📸</span>
                封面截取
              </h4>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <p className="text-sm text-slate-300 leading-relaxed">{guide.cover}</p>
              </div>
            </section>
          )}
        </div>
      </div>

      <style>{`
        .animate-in {
          animation: modal-in 0.2s ease-out;
        }
        @keyframes modal-in {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.5);
        }
      `}</style>
    </div>,
    document.body,
  );
}
