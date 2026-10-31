import { useState } from 'react';
import type { TaskClip, EditingGuide } from '../types/task';
import { formatClipTime, getClipDisplayRange } from '../utils/clipTime';
import { generateViralTitles, generateEditingGuide } from '../services/api';
import EditingGuideModal from './EditingGuideModal';

export type ClipItemProps = TaskClip;

interface ClipCardProps {
  clip: ClipItemProps;
  videoStartOffset?: number;
}

export default function ClipCard({
  clip,
  videoStartOffset = 0,
}: ClipCardProps) {
  // 爆款标题状态
  const [viralTitles, setViralTitles] = useState<string[] | null>(
    clip.viral_titles || null,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [showTitles, setShowTitles] = useState(!!clip.viral_titles?.length);
  const [genError, setGenError] = useState('');

  // 剪辑思路状态
  const [editingGuide, setEditingGuide] = useState<EditingGuide | null>(
    clip.editing_guide || null,
  );
  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false);
  const [showGuide, setShowGuide] = useState(!!clip.editing_guide);
  const [guideError, setGuideError] = useState('');
  const [guideModalOpen, setGuideModalOpen] = useState(false);

  const displayRange = getClipDisplayRange({
    startTime: clip.start_time,
    endTime: clip.end_time,
    videoStartOffset,
    hasGeneratedClip: Boolean(clip.download_url),
  });
  const copyableTimeRange =
    `${formatClipTime(displayRange.startTime)} - ${formatClipTime(displayRange.endTime)}`;

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(clip.suggested_caption).then(() => {
      const btn = document.getElementById(`copy-btn-${clip.id}`);
      if (btn) {
        const original = btn.innerText;
        btn.innerText = '已复制!';
        setTimeout(() => { btn.innerText = original; }, 2000);
      }
    });
  };

  const handleGenerateViralTitles = async () => {
    setIsGenerating(true);
    setGenError('');
    try {
      const result = await generateViralTitles(clip.id);
      setViralTitles(result.viral_titles);
      setShowTitles(true);
    } catch (err) {
      console.error('生成爆款标题失败', err);
      setGenError('生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyTitle = (title: string, index: number) => {
    navigator.clipboard.writeText(title).then(() => {
      const btn = document.getElementById(`viral-copy-${clip.id}-${index}`);
      if (btn) {
        btn.innerText = '已复制';
        setTimeout(() => { btn.innerText = '复制'; }, 1500);
      }
    });
  };

  const handleGenerateGuide = async () => {
    setIsGeneratingGuide(true);
    setGuideError('');
    try {
      const result = await generateEditingGuide(clip.id);
      setEditingGuide(result.editing_guide);
      setShowGuide(true);
      setGuideModalOpen(true);
    } catch (err) {
      console.error('生成剪辑思路失败', err);
      setGuideError('生成失败，请重试');
    } finally {
      setIsGeneratingGuide(false);
    }
  };

  // 生成星级，最高 10 分
  const starsArray = Array(5).fill(0);
  const scoreTo5 = Math.round(clip.virality_score / 2);

  return (
    <div className="glass-card flex flex-col h-full overflow-hidden">
      {/* 顶部标识：优先展示时间 */}
      <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700 font-medium flex justify-between items-center">
        <div className="flex items-center gap-3 overflow-hidden">
          <span className="w-6 h-6 rounded bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs shrink-0 border border-violet-500/30">
            #{clip.clip_index}
          </span>
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-base font-mono text-slate-100 font-bold tracking-tight truncate">
              {formatClipTime(displayRange.startTime)} → {formatClipTime(displayRange.endTime)}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(copyableTimeRange);
                const btn = document.getElementById(`time-top-btn-${clip.id}`);
                if (btn) { 
                  btn.innerHTML = '<svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>'; 
                  setTimeout(() => { 
                    btn.innerHTML = '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>'; 
                  }, 1500); 
                }
              }}
              id={`time-top-btn-${clip.id}`}
              title="复制时间"
              className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </button>
          </div>
        </div>
        <span className="text-xs text-violet-300 whitespace-nowrap font-mono bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded ml-2 shrink-0">
          {formatClipTime(clip.duration)}
        </span>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        {/* 标题 */}
        <div className="mb-4">
          <h4 className="text-lg font-bold text-white leading-snug">{clip.title}</h4>
        </div>

        {/* 数据面板 */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1 bg-slate-900/50 rounded-lg p-3 border border-slate-800">
            <div className="text-xs text-slate-400 mb-1">内容分类</div>
            <div className="text-sm font-medium text-emerald-400">{clip.clip_type}</div>
          </div>
          <div className="flex-1 bg-slate-900/50 rounded-lg p-3 border border-slate-800">
            <div className="text-xs text-slate-400 mb-1">爆款指数 (1-10)</div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-amber-400 mr-1">{clip.virality_score}</span>
              <div className="flex gap-0.5">
                {starsArray.map((_, i) => (
                  <svg key={i} className={`w-3 h-3 ${i < scoreTo5 ? 'text-amber-400' : 'text-slate-700'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 摘要 */}
        <div className="mb-4 flex-1">
          <p className="text-sm text-slate-300 leading-relaxed">
            {clip.summary}
          </p>
        </div>

        {/* 推荐文案 */}
        <div className="bg-slate-900/80 rounded-lg p-3 mb-4 group relative border border-slate-700">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-slate-400">推荐发布文案</span>
            <button 
              id={`copy-btn-${clip.id}`}
              onClick={handleCopyCaption}
              className="text-xs text-violet-400 hover:text-violet-300 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              复制
            </button>
          </div>
          <p className="text-xs text-slate-300 italic">
            "{clip.suggested_caption}"
          </p>
        </div>

        {/* 🔥 爆款标题推荐区域 */}
        <div className="mb-4">
          {!showTitles ? (
            <button
              onClick={handleGenerateViralTitles}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-orange-500/10 to-rose-500/10 border border-orange-500/20 text-orange-300 text-sm font-medium hover:from-orange-500/20 hover:to-rose-500/20 hover:border-orange-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  AI 正在生成爆款标题...
                </>
              ) : (
                <>🔥 生成爆款标题</>
              )}
            </button>
          ) : (
            <div className="bg-slate-900/80 rounded-xl border border-orange-500/20 overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2.5 border-b border-slate-800/80">
                <span className="text-xs font-medium text-orange-400 flex items-center gap-1.5">
                  🔥 爆款标题推荐
                </span>
                <button
                  onClick={handleGenerateViralTitles}
                  disabled={isGenerating}
                  className="text-xs text-slate-400 hover:text-orange-300 transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      生成中
                    </>
                  ) : (
                    <>🔄 换一批</>
                  )}
                </button>
              </div>
              <div className="divide-y divide-slate-800/50">
                {viralTitles?.map((title, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between px-4 py-2 group/title hover:bg-slate-800/30 transition-colors"
                  >
                    <span className="text-sm text-slate-200 flex-1 mr-3">
                      <span className="text-orange-400/60 text-xs mr-2 font-mono">{index + 1}.</span>
                      {title}
                    </span>
                    <button
                      id={`viral-copy-${clip.id}-${index}`}
                      onClick={() => handleCopyTitle(title, index)}
                      className="text-xs text-slate-500 hover:text-orange-300 opacity-0 group-hover/title:opacity-100 transition-all shrink-0 px-2 py-0.5 rounded hover:bg-orange-500/10"
                    >
                      复制
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {genError && (
            <p className="text-xs text-red-400 mt-2 text-center">{genError}</p>
          )}
        </div>

        {/* 🎬 剪辑思路区域 */}
        <div className="mb-5">
          {!showGuide ? (
            <button
              onClick={handleGenerateGuide}
              disabled={isGeneratingGuide}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 text-cyan-300 text-sm font-medium hover:from-cyan-500/20 hover:to-blue-500/20 hover:border-cyan-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingGuide ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  AI 正在生成剪辑思路...
                </>
              ) : (
                <>🎬 生成剪辑思路</>
              )}
            </button>
          ) : (
            <button
              onClick={() => setGuideModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 text-cyan-300 text-sm font-medium hover:from-cyan-500/20 hover:to-blue-500/20 hover:border-cyan-500/40 transition-all"
            >
              🎬 查看剪辑思路
              <span className="text-xs text-cyan-400/50 ml-1">已生成</span>
            </button>
          )}
          {guideError && (
            <p className="text-xs text-red-400 mt-2 text-center">{guideError}</p>
          )}
        </div>

        {/* 剪辑思路弹窗 */}
        {editingGuide && (
          <EditingGuideModal
            guide={editingGuide}
            clipTitle={clip.title}
            isOpen={guideModalOpen}
            onClose={() => setGuideModalOpen(false)}
            onRegenerate={handleGenerateGuide}
            isRegenerating={isGeneratingGuide}
          />
        )}

        {/* 操作区 */}
        <div className="space-y-2">
          {clip.download_url ? (
            <a 
              href={clip.download_url} 
              target="_blank" 
              rel="noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 transition-colors text-white text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              下载切片
            </a>
          ) : (
            <button
              onClick={() => {
                navigator.clipboard.writeText(copyableTimeRange);
                const btn = document.getElementById(`bottom-copy-msg-${clip.id}`);
                if (btn) { 
                  btn.innerText = '已复制！去剪映中裁切'; 
                  setTimeout(() => { btn.innerText = '一键复制时间，去剪映中裁切'; }, 2000); 
                }
              }}
              className="w-full py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-sm font-medium text-center hover:border-slate-500 hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span id={`bottom-copy-msg-${clip.id}`}>一键复制时间，去剪映中裁切</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
