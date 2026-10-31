import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FileUploader from '../components/FileUploader';
import { createTask } from '../services/api';
import { SCENE_MODE_OPTIONS } from '../types/task';
import type { SceneMode } from '../types/task';

type Status = 'idle' | 'extracting' | 'uploading' | 'processing' | 'error';

export default function UploadPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [cancelUpload, setCancelUpload] = useState<(() => void) | null>(null);
  const [sceneMode, setSceneMode] = useState<SceneMode>('livestream');

  const handleUploadStart = () => {
    setStatus('extracting');
    setProgress(0);
    setProgressMessage('准备中...');
    setErrorMessage('');
    setNoticeMessage('');
  };

  const handleExtractProgress = (p: number, message: string) => {
    setStatus('extracting');
    setProgress(p);
    setProgressMessage(message);
  };

  const handleUploadProgress = (p: number) => {
    setStatus('uploading');
    setProgress(p);
    setProgressMessage('正在上传音频...');
  };

  const handleUploadSuccess = async (
    file: File,
    audioPath: string,
    startOffset: number,
    videoDuration: number | null,
  ) => {
    setStatus('processing');
    setProgress(95);
    setProgressMessage('上传完成，正在创建任务...');
    setCurrentFile(file);
    
    try {
      const task = await createTask({
        video_filename: file.name,
        video_path: audioPath,
        video_start_offset: startOffset || 0,
        video_duration: videoDuration ?? undefined,
        scene_mode: sceneMode,
      });
      
      navigate(`/tasks/${task.id}`);
    } catch (error) {
      console.error('任务创建失败:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : '创建处理任务失败');
    }
  };

  const handleUploadError = (error: Error) => {
    setStatus('error');
    setErrorMessage(error.message);
    setCancelUpload(null);
  };

  const handleUploadCancelled = (message: string) => {
    setStatus('idle');
    setProgress(0);
    setProgressMessage('');
    setErrorMessage('');
    setCurrentFile(null);
    setCancelUpload(null);
    setNoticeMessage(message);
  };

  const handleCancelChange = (cancel: (() => void) | null) => {
    setCancelUpload(() => cancel);
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'extracting': return '正在提取音频';
      case 'uploading': return '正在上传音频';
      case 'processing': return '准备分析';
      default: return '';
    }
  };

  const getStatusDescription = () => {
    if (progressMessage) return progressMessage;
    switch (status) {
      case 'extracting':
        return `浏览器端解析视频中，无需上传完整文件... ${currentFile?.name || ''}`;
      case 'uploading':
        return '音频已提取，正在上传至服务器...';
      case 'processing':
        return '上传完成，正在初始化 AI 引擎即将跳转...';
      default:
        return '';
    }
  };

  const selectedScene = SCENE_MODE_OPTIONS.find(o => o.value === sceneMode)!;

  return (
    <div className="max-w-3xl mx-auto pt-10">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold mb-4 tracking-tight">AI 智能视频切片</h2>
        <p className="text-lg text-slate-400">
          上传视频，AI 根据场景智能切分为精华片段
        </p>
      </div>

      {/* ── 场景模式选择器 ── */}
      {(status === 'idle' || status === 'error') && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            选择视频类型
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {SCENE_MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                id={`scene-mode-${option.value}`}
                onClick={() => setSceneMode(option.value)}
                className={`relative p-4 rounded-xl border text-left transition-all duration-300 group overflow-hidden ${
                  sceneMode === option.value
                    ? 'border-violet-500/70 bg-violet-500/10 shadow-[0_0_20px_rgba(139,92,246,0.15)]'
                    : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50'
                }`}
              >
                {/* 选中指示器 */}
                {sceneMode === option.value && (
                  <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                <span className="text-2xl mb-2 block">{option.icon}</span>
                <h4 className={`font-bold text-sm mb-1 ${
                  sceneMode === option.value ? 'text-violet-300' : 'text-slate-200'
                }`}>
                  {option.label}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">{option.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="glass-card p-1">
        <div className="bg-slate-900 rounded-xl p-8 min-h-[400px] flex flex-col justify-center relative overflow-hidden">
          
          {status === 'idle' || status === 'error' ? (
            <div className="z-10 relative">
              <FileUploader 
                onUploadStart={handleUploadStart}
                onExtractProgress={handleExtractProgress}
                onUploadProgress={handleUploadProgress}
                onUploadSuccess={handleUploadSuccess}
                onUploadError={handleUploadError}
                onUploadCancelled={handleUploadCancelled}
                onCancelChange={handleCancelChange}
              />

              {status === 'idle' && noticeMessage && (
                <div className="mt-6 p-4 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 flex items-start gap-3">
                  <svg className="w-5 h-5 shrink-0 mt-0.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="font-semibold">已停止当前处理</h4>
                    <p className="text-sm mt-1">{noticeMessage}</p>
                  </div>
                </div>
              )}
              
              {status === 'error' && (
                <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3">
                  <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="font-semibold">处理出错</h4>
                    <p className="text-sm mt-1">{errorMessage}</p>
                    <button 
                      onClick={() => setStatus('idle')}
                      className="mt-3 text-sm text-red-300 hover:text-red-200 underline underline-offset-2"
                    >
                      重新尝试
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="z-10 flex flex-col items-center justify-center py-12">
              <div className="relative w-32 h-32 mb-8">
                {/* 环形进度条背景 */}
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-800" />
                  <circle 
                    cx="50" cy="50" r="45" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="8" 
                    strokeLinecap="round"
                    className={`${status === 'extracting' ? 'text-amber-500' : 'text-violet-500'} transition-all duration-500`}
                    strokeDasharray="283"
                    strokeDashoffset={283 - (283 * progress) / 100}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className={`text-3xl font-bold bg-gradient-to-r ${status === 'extracting' ? 'from-amber-400 to-orange-400' : 'from-violet-400 to-indigo-400'} bg-clip-text text-transparent`}>
                    {progress}%
                  </span>
                </div>
              </div>
              
              {/* 场景标签 */}
              <div className="mb-4 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-400 flex items-center gap-1.5">
                <span>{selectedScene.icon}</span>
                <span>{selectedScene.label}模式</span>
              </div>

              {/* 阶段指示器 */}
              <div className="flex items-center gap-3 mb-4">
                {['extracting', 'uploading', 'processing'].map((step, i) => (
                  <div key={step} className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                      status === step 
                        ? 'bg-violet-500 ring-4 ring-violet-500/20' 
                        : ['extracting', 'uploading', 'processing'].indexOf(status) > i
                          ? 'bg-emerald-500'
                          : 'bg-slate-700'
                    }`} />
                    {i < 2 && <div className={`w-8 h-0.5 ${
                      ['extracting', 'uploading', 'processing'].indexOf(status) > i ? 'bg-emerald-500/50' : 'bg-slate-700'
                    }`} />}
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-slate-500 w-48 mb-6">
                <span className={status === 'extracting' ? 'text-amber-400' : ''}>提取</span>
                <span className={status === 'uploading' ? 'text-violet-400' : ''}>上传</span>
                <span className={status === 'processing' ? 'text-violet-400' : ''}>分析</span>
              </div>

              <h3 className="text-xl font-semibold mb-2">
                {getStatusLabel()}
              </h3>
              <p className="text-slate-400 text-sm max-w-sm text-center">
                {getStatusDescription()}
              </p>
              {cancelUpload && status !== 'processing' && (
                <button
                  onClick={cancelUpload}
                  className="mt-6 px-5 py-2.5 rounded-xl border border-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-800 hover:border-slate-500 transition-colors"
                >
                  取消当前处理
                </button>
              )}
            </div>
          )}
          
          {/* 装饰性背景 */}
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
        </div>
      </div>

      {/* 步骤指引 */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { num: '01', title: '选择场景', desc: '选择视频类型：直播回放找爆款、面试录像按问答切分、课程讲座按知识点拆分' },
          { num: '02', title: '智能分析', desc: 'ASR 语音识别 + DeepSeek 大模型，根据场景策略自动定位切片点' },
          { num: '03', title: '一键导出', desc: 'AI 输出精彩片段时间点 + 标题文案，支持剪映草稿 / FFmpeg 切片 / SRT 字幕' }
        ].map((step) => (
          <div key={step.num} className="glass-card p-6 flex flex-col">
            <span className="text-3xl font-black text-slate-800 mb-4">{step.num}</span>
            <h4 className="text-lg font-bold text-slate-200 mb-2">{step.title}</h4>
            <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

