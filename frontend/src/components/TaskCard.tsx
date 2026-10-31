import { Link } from 'react-router-dom';
import type { TaskListItem } from '../types/task';
import { SCENE_MODE_OPTIONS } from '../types/task';
import { formatTaskDuration } from '../utils/taskTime';

export type TaskListItemProps = TaskListItem;

export default function TaskCard({ 
  task, 
  onDelete 
}: { 
  task: TaskListItemProps, 
  onDelete?: (id: string, e: React.MouseEvent) => void 
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'pending': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      default: return 'bg-violet-500/20 text-violet-400 border-violet-500/30';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'done': return '已完成';
      case 'failed': return '处理失败';
      case 'pending': return '等待处理';
      case 'downloading': return '下载源视频';
      case 'transcribing': return '提取字幕';
      case 'analyzing': return 'AI 分析中';
      case 'clipping': return '视频切片中';
      case 'uploading': return '上传切片';
      default: return '处理中';
    }
  };

  const isProcessing = ['downloading', 'transcribing', 'analyzing', 'clipping', 'uploading'].includes(task.status);
  
  // Format date
  const date = new Date(task.created_at);
  const formattedDate = `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  const formattedDuration = formatTaskDuration(task.video_duration);
  const sceneOption = SCENE_MODE_OPTIONS.find(o => o.value === task.scene_mode);
  const finishedMeta = formattedDuration
    ? `${formattedDate} · ${formattedDuration}`
    : formattedDate;
  const failedMeta = formattedDuration
    ? `${task.progress_message} · ${formattedDuration}`
    : task.progress_message;

  return (
    <Link 
      to={`/tasks/${task.id}`}
      className="glass-card p-5 block hover:border-violet-500/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] group relative overflow-hidden"
    >
      {/* Background progress indicator limit if processing */}
      {isProcessing && (
        <div 
          className="absolute top-0 left-0 h-1 bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-1000 ease-in-out"
          style={{ width: `${task.progress}%` }}
        />
      )}

      <div className="flex justify-between items-start mb-3">
        <div className="min-w-0 flex-1 pr-4">
          <h3 className="font-semibold text-lg text-slate-200 truncate group-hover:text-violet-400 transition-colors">
            {task.video_filename}
          </h3>
          {sceneOption && sceneOption.value !== 'livestream' && (
            <span className="inline-flex items-center gap-1 mt-1 text-xs text-slate-500">
              <span>{sceneOption.icon}</span>
              <span>{sceneOption.label}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-md text-xs font-medium border whitespace-nowrap flex items-center gap-1.5 ${getStatusColor(task.status)}`}>
            {isProcessing && (
              <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {getStatusText(task.status)}
          </span>
          {onDelete && (
            <button 
              onClick={(e) => onDelete(task.id, e)}
              className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
              title="删除任务"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-between items-end mt-4">
        <div className="text-sm text-slate-400 font-medium">
          {isProcessing ? task.progress_message : task.status === 'failed' ? failedMeta : finishedMeta}
        </div>
        
        {isProcessing && (
          <div className="text-right">
            <span className="text-xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              {task.progress}%
            </span>
            {formattedDuration && (
              <div className="text-xs text-slate-500 font-mono mt-1">
                {formattedDuration}
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
