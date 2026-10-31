import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ProgressBar from '../components/ProgressBar';
import ClipCard from '../components/ClipCard';
import LocalClipExportModal from '../components/LocalClipExportModal';
import { getTask, retryTask, renameTask } from '../services/api';
import {
  exportVideoClipsLocally,
  type LocalClipExportProgress,
} from '../services/videoClipExporter';
import {
  buildClipArchiveName,
  summarizeLocalClipExport,
} from '../utils/localClipExport';
import type { TaskDetail } from '../types/task';

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  // 导出相关状态
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState('');
  const [showClipModal, setShowClipModal] = useState(false);
  const [clipExportProgress, setClipExportProgress] = useState<LocalClipExportProgress | null>(null);
  const clipExportAbortRef = useRef<AbortController | null>(null);
  const [startedAt, setStartedAt] = useState<number>(0);

  const hasResponseStatus = (
    error: unknown,
  ): error is { response?: { status?: number } } =>
    typeof error === 'object' && error !== null && 'response' in error;

  const handleSaveTitle = async () => {
    if (!taskId || !newTitle.trim() || newTitle === task?.video_filename) {
      setIsRenaming(false);
      return;
    }
    setIsSavingTitle(true);
    try {
      const updated = await renameTask(taskId, newTitle);
      setTask(updated);
      setIsRenaming(false);
    } catch (err) {
      console.error('重命名失败', err);
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleRetry = async () => {
    if (!taskId || isRetrying) return;
    setIsRetrying(true);
    try {
      const data = await retryTask(taskId);
      setTask(data);
    } catch (err: unknown) {
      console.error('重试失败', err);
      // 400 通常表示任务已在处理中，刷新页面数据展示最新状态
      if (hasResponseStatus(err) && err.response?.status === 400) {
        const freshData = await getTask(taskId);
        setTask(freshData);
      }
    } finally {
      setIsRetrying(false);
    }
  };

  // ── 导出处理 ──
  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportClips = async (videoFile: File) => {
    if (!task || !task.clips?.length) return;

    const abortController = new AbortController();
    clipExportAbortRef.current = abortController;
    setIsExporting('clips');
    setExportMsg('');
    setClipExportProgress(null);

    try {
      const result = await exportVideoClipsLocally({
        videoFile,
        clips: task.clips,
        videoStartOffset: task.video_start_offset,
        signal: abortController.signal,
        onProgress: setClipExportProgress,
      });

      triggerDownload(result.blob, buildClipArchiveName(task.video_filename));
      setShowClipModal(false);
      setExportMsg(summarizeLocalClipExport(result));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setExportMsg('已取消切片');
      } else if (error instanceof Error && error.message) {
        setExportMsg(error.message);
      } else {
        setExportMsg('切片失败');
      }
    } finally {
      setIsExporting(null);
      setClipExportProgress(null);
      clipExportAbortRef.current = null;
    }
  };

  const handleCancelClipExport = () => {
    clipExportAbortRef.current?.abort();
  };



  // 初始加载及状态兜底
  useEffect(() => {
    const fetchTask = async () => {
      if (!taskId) return;
      try {
        const data = await getTask(taskId);
        setTask(data);
      } catch (err) {
        console.error('获取任务详情失败', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTask();
  }, [taskId]);

  useEffect(() => {
    return () => {
      clipExportAbortRef.current?.abort();
    };
  }, []);

  // 请求浏览器通知权限（静默请求，不弹窗）
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // 任务完成时发送浏览器通知
  const sendCompletionNotification = (taskName: string, status: string) => {
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      const isSuccess = status === 'done';
      new Notification(isSuccess ? '✅ 切片完成！' : '❌ 处理失败', {
        body: taskName,
        icon: '/vite.svg',
      });
    }
  };

  // SSE 实时进度 + 轮询兜底
  useEffect(() => {
    if (!taskId || !task || ['done', 'failed'].includes(task.status)) return;

    let pollingTimer: ReturnType<typeof setInterval> | null = null;

    // 轮询兜底：SSE 断开时每 5 秒拉一次状态
    const startPolling = () => {
      if (pollingTimer) return;
      pollingTimer = setInterval(async () => {
        try {
          const data = await getTask(taskId);
          setTask(data);
          if (['done', 'failed'].includes(data.status)) {
            sendCompletionNotification(data.video_filename, data.status);
            stopPolling();
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 5000);
    };

    const stopPolling = () => {
      if (pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = null;
      }
    };

    // SSE 优先
    const eventSource = new EventSource(`/api/tasks/${taskId}/progress`);
    
    eventSource.onopen = () => {
      stopPolling(); // SSE 成功连接，停止轮询
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.started_at && data.started_at > 0) {
          setStartedAt(data.started_at);
        }
        setTask(prev => {
          if (!prev) return prev;
          
          const updated = {
            ...prev,
            progress: data.progress,
            progress_message: data.message,
            status: data.status,
          };

          if (data.status === 'done' && prev.status !== 'done') {
            getTask(taskId).then(completedData => setTask(completedData));
            sendCompletionNotification(prev.video_filename, 'done');
          }
          if (data.status === 'failed' && prev.status !== 'failed') {
            sendCompletionNotification(prev.video_filename, 'failed');
          }

          return updated;
        });

        if (data.status === 'done' || data.status === 'failed') {
          eventSource.close();
        }
      } catch (err) {
        console.error('SSE Error:', err);
      }
    };

    eventSource.onerror = () => {
      console.log('SSE disconnected, falling back to polling');
      eventSource.close();
      startPolling(); // SSE 断开，自动降级为轮询
    };

    return () => {
      eventSource.close();
      stopPolling();
    };
  }, [taskId, task?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-20 glass-card">
        <h3 className="text-xl font-semibold mb-2">未找到该任务</h3>
        <p className="text-slate-400 mb-6">检查链接是否正确或返回列表页</p>
        <Link to="/tasks" className="btn-secondary">返回任务列表</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pt-6">
      {/* 头部面包屑与标题 */}
      <div className="mb-8">
        <Link to="/tasks" className="text-sm border flex items-center justify-center p-0 m-0 w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white border-slate-700 hover:bg-slate-700 transition-colors mb-4">
          <svg className="w-4 h-4 text-center mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h2 className="text-2xl font-bold flex items-center gap-3 group">
          {isRenaming ? (
            <div className="flex items-center gap-2">
               <input
                 type="text"
                 value={newTitle}
                 onChange={(e) => setNewTitle(e.target.value)}
                 className="bg-slate-800 border items-center border-slate-600 rounded px-2 py-1 text-white text-xl outline-none focus:border-violet-500 w-[500px]"
                 autoFocus
                 disabled={isSavingTitle}
                 onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      await handleSaveTitle();
                    } else if (e.key === 'Escape') {
                      setIsRenaming(false);
                    }
                 }}
                 onBlur={() => {
                    if (!isSavingTitle) setIsRenaming(false);
                 }}
               />
               {isSavingTitle && (
                  <svg className="animate-spin h-5 w-5 text-violet-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
               )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span>{task.video_filename}</span>
              <button 
                onClick={() => {
                  setNewTitle(task.video_filename);
                  setIsRenaming(true);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded"
                title="重命名"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          )}
          <span className="text-xs font-normal py-1 px-3 rounded-full bg-slate-800 text-slate-400 border border-slate-700 ml-auto">
            {new Date(task.created_at).toLocaleString()}
          </span>
        </h2>
      </div>

      {/* 进度条区块 */}
      <ProgressBar 
        progress={task.progress} 
        message={task.error_message || task.progress_message} 
        status={task.status}
        startedAt={startedAt}
      />

      {/* 失败或卡在等待中时显示重试按钮 */}
      {(task.status === 'failed' || (task.status === 'pending' && task.progress === 0)) && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-600 text-white rounded-xl font-medium transition-all duration-200 flex items-center gap-2"
          >
            {isRetrying ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                重新处理中...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                重新处理
              </>
            )}
          </button>
        </div>
      )}


      {/* 切片结果列表区块 */}
      <div className="mt-12">
        <div className="flex justify-between items-end mb-6">
          <h3 className="text-xl font-bold">
            生成切片 <span className="text-violet-400 ml-2">{task.clips?.length || 0}</span>
          </h3>
           {task.status !== 'done' && task.status !== 'failed' && (
             <div className="text-sm text-slate-400 flex items-center gap-2">
               <span className="relative flex h-3 w-3">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-500"></span>
               </span>
               后台处理中，可放心离开此页面
             </div>
          )}
        </div>

        {showClipModal && (
          <LocalClipExportModal
            taskFilename={task.video_filename}
            clipCount={task.clips?.length || 0}
            exporting={isExporting === 'clips'}
            exportMessage={exportMsg}
            progress={clipExportProgress}
            onClose={() => {
              if (isExporting === 'clips') return;
              setShowClipModal(false);
            }}
            onConfirm={handleExportClips}
            onCancelExport={handleCancelClipExport}
          />
        )}

        {/* 导出操作栏 */}
        {task.status === 'done' && task.clips && task.clips.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={() => {
                setExportMsg('');
                setClipExportProgress(null);
                setShowClipModal(true);
              }}
              disabled={isExporting === 'clips'}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 rounded-xl text-sm font-medium hover:bg-emerald-600/30 hover:border-emerald-500/50 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" /></svg>
              ✂️ 一键切片
            </button>

            {exportMsg && !showClipModal && (
              <span className="flex items-center text-xs text-emerald-400 ml-2">✓ {exportMsg}</span>
            )}
          </div>
        )}

        {task.clips && task.clips.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {task.clips.map(clip => (
              <ClipCard
                key={clip.id}
                clip={clip}
                videoStartOffset={task.video_start_offset}
              />
            ))}
          </div>
        ) : task.status === 'done' ? (
          <div className="glass-card p-12 text-center">
            <svg className="w-12 h-12 mx-auto mb-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-slate-300 text-lg font-medium mb-2">本次未生成切片</p>
            <p className="text-slate-500 text-sm mb-6">
              可能原因：转录结果为空、AI 未识别到精彩片段、或处理过程异常。
              <br />请检查上方的处理状态消息获取详情。
            </p>
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-600 text-white rounded-xl text-sm font-medium transition-all duration-200 inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              重新处理
            </button>
          </div>
        ) : (
          <div className="glass-card p-12 text-center flex flex-col items-center justify-center opacity-60 min-h-[300px]">
            <div className="grid grid-cols-3 gap-4 w-full max-w-sm mb-6 opacity-30">
              <div className="h-2 w-full bg-slate-700 rounded animate-pulse"></div>
              <div className="h-2 w-full bg-slate-700 rounded animate-pulse delay-75"></div>
              <div className="h-2 w-full bg-slate-700 rounded animate-pulse delay-150"></div>
            </div>
            <p className="text-slate-400">正在等待提取剪辑点...</p>
          </div>
        )}
      </div>
    </div>
  );
}
