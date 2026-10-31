import { useEffect, useRef, useState } from 'react';

interface ProgressBarProps {
  progress: number;
  message: string;
  status: string;
  startedAt?: number; // Unix timestamp (秒)
}

const STEPS = [
  { id: 'downloading', label: '准备源数据', detail: '正在下载并解码源视频文件...' },
  { id: 'transcribing', label: 'AI 转录', detail: '语音识别引擎正在将音频转为文字...' },
  { id: 'analyzing', label: 'LLM 剧本分析', detail: '大语言模型正在分析转录文本，提取精彩片段...' },
  { id: 'clipping', label: '生成切片', detail: '正在使用 FFmpeg 逐段精确裁剪视频...' },
  { id: 'uploading', label: '云端同步', detail: '正在将切片上传至云存储...' },
];

function formatEta(seconds: number): string {
  if (seconds < 60) return `约 ${Math.ceil(seconds)} 秒`;
  if (seconds < 3600) return `约 ${Math.ceil(seconds / 60)} 分钟`;
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  return `约 ${h} 小时 ${m} 分钟`;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m${s.toString().padStart(2, '0')}s`;
}

export default function ProgressBar({ progress, message, status, startedAt }: ProgressBarProps) {
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 计时器：每秒更新已用时间
  useEffect(() => {
    if (!startedAt || startedAt <= 0 || ['done', 'failed'].includes(status)) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const tick = () => setElapsed(Math.max(0, Date.now() / 1000 - startedAt));
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startedAt, status]);

  // 当前步骤索引
  let currentStepIndex = 0;
  if (status === 'done') currentStepIndex = STEPS.length;
  else if (status === 'failed') currentStepIndex = -1;
  else {
    const foundIndex = STEPS.findIndex(s => s.id === status);
    if (foundIndex !== -1) currentStepIndex = foundIndex;
  }

  const isFailed = status === 'failed';
  const isDone = status === 'done';
  const isProcessing = !isFailed && !isDone;

  // ETA 计算
  let etaStr = '';
  if (isProcessing && progress > 5 && elapsed > 10) {
    const speed = progress / elapsed; // %/秒
    const remaining = (100 - progress) / speed;
    if (remaining > 0 && remaining < 86400) {
      etaStr = formatEta(remaining);
    }
  }

  return (
    <div className="glass-card p-6 md:p-8 mb-8">
      {/* 顶部：标题 + 百分比 + 时间信息 */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-xl font-semibold mb-1">
            {isFailed ? '任务执行失败' : isDone ? '处理完成 🎉' : 'AI 处理中...'}
          </h3>
          <p className={`text-sm ${isFailed ? 'text-red-400' : 'text-slate-400'}`}>
            {message}
          </p>
          {/* 时间行 */}
          {isProcessing && elapsed > 0 && (
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
              <span>已用 {formatElapsed(elapsed)}</span>
              {etaStr && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="text-indigo-400/80">预计还需 {etaStr}</span>
                </>
              )}
            </div>
          )}
        </div>
        {!isFailed && (
          <div className="text-3xl font-black bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            {progress}%
          </div>
        )}
      </div>

      {/* 进度条 */}
      <div className="relative">
        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out relative ${
              isFailed
                ? 'bg-red-500'
                : 'bg-gradient-to-r from-violet-600 to-indigo-500'
            }`}
            style={{ width: `${progress}%` }}
          >
            {/* 进度条尾部光晕 */}
            {isProcessing && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 bg-indigo-400/40 rounded-full blur-md animate-pulse" />
            )}
          </div>
        </div>

        {/* 步骤指示器 */}
        {!isFailed && (
          <div className="mt-6 flex justify-between relative px-2">
            {STEPS.map((step, idx) => {
              const state =
                idx < currentStepIndex ? 'completed' :
                idx === currentStepIndex ? 'current' : 'upcoming';

              return (
                <div key={step.id} className="flex flex-col items-center w-1/5 relative z-10">
                  {/* 圆点 */}
                  <div
                    className={`w-6 h-6 rounded-full mb-2 flex items-center justify-center transition-all duration-500 ${
                      state === 'completed'
                        ? 'bg-violet-500 text-white shadow-[0_0_10px_rgba(139,92,246,0.5)]'
                        : state === 'current'
                        ? 'text-white ring-2 ring-indigo-400/50 shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                        : 'bg-slate-700 text-slate-400 border border-slate-600'
                    }`}
                    style={
                      state === 'current'
                        ? {
                            background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                            animation: 'breathe 2s ease-in-out infinite',
                          }
                        : undefined
                    }
                  >
                    {state === 'completed' ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : state === 'current' ? (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-current" />
                    )}
                  </div>
                  {/* 标签 */}
                  <span
                    className={`text-xs text-center font-medium leading-tight ${
                      state === 'completed'
                        ? 'text-violet-300'
                        : state === 'current'
                        ? 'text-indigo-300'
                        : 'text-slate-500'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 当前阶段详情卡片 */}
      {isProcessing && currentStepIndex >= 0 && currentStepIndex < STEPS.length && (
        <div className="mt-6 px-4 py-3 bg-slate-800/60 rounded-xl border border-slate-700/50 flex items-center gap-3">
          {/* 呼吸灯 */}
          <div className="relative flex-shrink-0">
            <span className="flex h-3 w-3">
              <span
                className="absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                  animation: 'breathe 2s ease-in-out infinite',
                }}
              />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500" />
            </span>
          </div>
          <span className="text-sm text-slate-300">
            {STEPS[currentStepIndex].detail}
          </span>
        </div>
      )}

      {/* 呼吸灯 CSS 动画 */}
      <style>{`
        @keyframes breathe {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
