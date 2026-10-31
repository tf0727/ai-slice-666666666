import { useRef, useState } from 'react';
import { extractAudio, formatFileSize } from '../services/audioExtractor';
import { uploadAudio } from '../services/api';
import type { ExtractProgress } from '../services/audioExtractor';
import { classifyUploadFailure } from '../utils/uploadFlow';

interface FileUploaderProps {
  onUploadStart: () => void;
  onExtractProgress: (progress: number, message: string) => void;
  onUploadProgress: (progress: number) => void;
  onUploadSuccess: (originalFile: File, audioPath: string, startOffset: number, videoDuration: number | null) => void;
  onUploadError: (error: Error) => void;
  onUploadCancelled: (message: string) => void;
  onCancelChange: (cancel: (() => void) | null) => void;
}

export default function FileUploader({
  onUploadStart,
  onExtractProgress,
  onUploadProgress,
  onUploadSuccess,
  onUploadError,
  onUploadCancelled,
  onCancelChange,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    // 验证文件类型
    if (!file.type.startsWith('video/') && !file.name.match(/\.(mkv|flv|avi|wmv|mov|mp4|ts|m4v)$/i)) {
      onUploadError(new Error('请上传视频格式的文件'));
      return;
    }
    
    try {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      onCancelChange(() => {
        abortControllerRef.current?.abort();
      });
      onUploadStart();

      // ── Step 1：浏览器端提取音频 ──
      const fileSizeStr = formatFileSize(file.size);
      onExtractProgress(0, `正在解析视频 (${fileSizeStr})...`);

      const { blob, filename, startOffset, videoDuration } = await extractAudio(
        file,
        (p: ExtractProgress) => {
          // 提取阶段占总进度 0-70%
          const overallProgress = Math.round(p.ratio * 70);
          onExtractProgress(overallProgress, p.message);
        },
        abortController.signal,
      );

      const audioSizeStr = formatFileSize(blob.size);
      if (startOffset > 0) {
        onExtractProgress(70, `音频提取完成 (${audioSizeStr})，检测到视频偏移 ${Math.floor(startOffset/3600)}h${Math.floor((startOffset%3600)/60)}m`);
      } else {
        onExtractProgress(70, `音频提取完成 (${audioSizeStr})，开始上传...`);
      }

      // ── Step 2：上传音频（体积已从 GB 缩减到 ~30 MB）──
      const result = await uploadAudio(
        blob,
        filename,
        (p: number) => {
          // 上传阶段占总进度 70-95%
          const overallProgress = 70 + Math.round(p * 0.25);
          onUploadProgress(overallProgress);
        },
        abortController.signal,
      );

      abortControllerRef.current = null;
      onCancelChange(null);
      onUploadSuccess(file, result.audio_path, startOffset, videoDuration);
    } catch (error) {
      console.error('处理失败:', error);
      abortControllerRef.current = null;
      onCancelChange(null);
      const failure = classifyUploadFailure(error);
      if (failure.kind === 'cancelled') {
        onUploadCancelled(failure.message);
        return;
      }
      onUploadError(new Error(failure.message));
    }
  };

  return (
    <div 
      className={`relative w-full p-12 mt-8 border-2 border-dashed rounded-3xl transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer overflow-hidden
        ${isDragging 
          ? 'border-violet-500 bg-violet-500/10 shadow-[0_0_30px_rgba(139,92,246,0.3)]' 
          : 'border-slate-700 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50'
        }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      {/* 背景光晕层 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-violet-600/20 rounded-full blur-[80px] pointer-events-none"></div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        accept="video/*,.mkv,.flv,.avi,.wmv,.ts,.m4v" 
        className="hidden" 
      />
      
      <div className="w-20 h-20 mb-6 rounded-2xl bg-gradient-to-tr from-violet-600/20 to-indigo-500/20 border border-violet-500/30 flex items-center justify-center">
        <svg className="w-10 h-10 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </div>
      
      <h3 className="text-xl font-semibold mb-2">点击选择或拖拽视频到这里</h3>
      <p className="text-slate-400 text-sm max-w-md mx-auto">
        支持 MP4, MKV, MOV, FLV 等常见视频格式。视频不会上传到服务器，浏览器端自动提取音频后只上传 ~30 MB 音频。
      </p>
      
      <div className="mt-8 px-6 py-2 rounded-full bg-slate-800 border border-slate-700 text-sm font-medium text-slate-300 flex items-center gap-2">
        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        上传体积缩减 99%，秒传体验
      </div>
    </div>
  );
}
