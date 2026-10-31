import { useEffect, useEffectEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import TaskCard from '../components/TaskCard';
import type { TaskListItemProps } from '../components/TaskCard';
import { deleteTask, getTasks } from '../services/api';
import { shouldPollTaskList } from '../utils/taskPolling';

export default function TaskListPage() {
  const [tasks, setTasks] = useState<TaskListItemProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const hasProcessingTasks = shouldPollTaskList(tasks);

  const confirmDelete = async () => {
    if (!taskToDelete) return;
    setIsDeleting(true);
    try {
      await deleteTask(taskToDelete);
      setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskToDelete));
      setTaskToDelete(null);
    } catch (err) {
      console.error('Failed to delete task:', err);
      // fallback to a simple alert if it really fails
      alert('删除失败，请稍后重试');
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchTasks = useEffectEvent(async (showLoadingSpinner: boolean) => {
    try {
      if (showLoadingSpinner) {
        setLoading(true);
      }
      setError('');
      const data = await getTasks();
      setTasks(data);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setError('加载任务列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void fetchTasks(true);
  }, []);

  useEffect(() => {
    if (hasProcessingTasks) {
      const timer = setInterval(() => {
        void fetchTasks(false);
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [hasProcessingTasks]);

  return (
    <div className="max-w-5xl mx-auto pt-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold mb-2">历史任务</h2>
          <p className="text-slate-400">查看所有的视频切片处理任务</p>
        </div>
        <Link to="/upload" className="btn-primary flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建切片任务
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500"></div>
        </div>
      ) : error ? (
        <div className="glass-card p-8 text-center text-red-400 border-red-500/20 bg-red-500/5">
          <p>{error}</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <div className="w-20 h-20 mx-auto bg-slate-800 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">暂无历史记录</h3>
          <p className="text-slate-400 mb-6">你还没有创建过任何自动切片任务</p>
          <Link to="/upload" className="btn-secondary">去创建第一个任务</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.map(task => (
            <TaskCard 
              key={task.id} 
              task={task} 
              onDelete={(id, e) => {
                e.preventDefault();
                setTaskToDelete(id);
              }}
            />
          ))}
        </div>
      )}

      {/* 删除确认弹窗 */}
      {taskToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-semibold mb-2">确认删除任务？</h3>
            <p className="text-slate-400 mb-6 line-clamp-2 text-sm leading-relaxed">
              您确定要永久删除这个切片任务吗？此操作无法撤销。
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setTaskToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 hover:border-slate-600"
                disabled={isDeleting}
              >
                取消
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600/90 hover:bg-red-500 rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-red-500/20"
                disabled={isDeleting}
              >
                {isDeleting && (
                  <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isDeleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
