import { Routes, Route, Navigate, Link } from 'react-router-dom'

import UploadPage from './pages/UploadPage'
import TaskListPage from './pages/TaskListPage'
import TaskDetailPage from './pages/TaskDetailPage'

function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <header className="px-8 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-md sticky top-0 z-10 w-full">
        <Link to="/upload" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center font-bold shadow-[0_0_15px_rgba(139,92,246,0.5)]">
            AI
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            Slice
          </h1>
        </Link>
        <nav className="flex gap-4">
          <Link to="/upload" className="text-sm text-slate-300 hover:text-white transition-colors">新建切片</Link>
          <Link to="/tasks" className="text-sm text-slate-300 hover:text-white transition-colors">历史任务</Link>
        </nav>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-8">
        <Routes>
          <Route path="/" element={<Navigate to="/upload" replace />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/tasks" element={<TaskListPage />} />
          <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App

