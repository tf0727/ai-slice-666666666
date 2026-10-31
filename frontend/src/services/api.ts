import axios from 'axios';

import type { EditingGuide, TaskDetail, TaskListItem } from '../types/task';
import { normalizeTaskDetailResponse } from '../utils/taskApi';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

export interface TaskCreate {
  video_path: string;
  video_filename: string;
  video_start_offset?: number;
  video_duration?: number;
  scene_mode?: string;
}

export interface UploadResult {
  audio_path: string;
  original_filename: string;
  size_bytes: number;
}

/**
 * 上传音频到后端本地存储（浏览器端提取后的 MP3）
 */
export const uploadAudio = async (
  blob: Blob,
  filename: string,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
): Promise<UploadResult> => {
  const formData = new FormData();
  formData.append('file', blob, filename);

  const { data } = await api.post<UploadResult>('/upload/audio', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0,
    signal,
    onUploadProgress: (event) => {
      if (event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  return data;
};

/**
 * 上传完整视频到后端（保留作为 fallback）
 */
export const uploadVideo = async (
  file: File,
  onProgress: (progress: number) => void,
): Promise<{ video_path: string; video_filename: string; size_bytes: number }> => {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await api.post('/upload/video', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0,
    onUploadProgress: (event) => {
      if (event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  return data;
};

export const createTask = async (payload: TaskCreate): Promise<TaskDetail> => {
  const { data } = await api.post<TaskDetail>('/tasks', payload);
  return normalizeTaskDetailResponse(data);
};

export const getTasks = async (): Promise<TaskListItem[]> => {
  const { data } = await api.get<TaskListItem[]>('/tasks');
  return data;
};

export const getTask = async (taskId: string): Promise<TaskDetail> => {
  const { data } = await api.get<TaskDetail>(`/tasks/${taskId}`);
  return normalizeTaskDetailResponse(data);
};

export const retryTask = async (taskId: string): Promise<TaskDetail> => {
  const { data } = await api.post<TaskDetail>(`/tasks/${taskId}/retry`);
  return normalizeTaskDetailResponse(data);
};

export const renameTask = async (taskId: string, newFilename: string): Promise<TaskDetail> => {
  const { data } = await api.patch<TaskDetail>(`/tasks/${taskId}/rename`, { video_filename: newFilename });
  return normalizeTaskDetailResponse(data);
};

export const deleteTask = async (taskId: string): Promise<{message: string, id: string}> => {
  const { data } = await api.delete(`/tasks/${taskId}`);
  return data;
};



/**
 * 为指定切片生成爆款标题推荐
 */
export const generateViralTitles = async (
  clipId: string,
): Promise<{ clip_id: string; viral_titles: string[] }> => {
  const { data } = await api.post(`/clips/${clipId}/viral-titles`, null, {
    timeout: 30000,
  });
  return data;
};

/**
 * 为指定切片生成剪辑思路
 */
export const generateEditingGuide = async (
  clipId: string,
): Promise<{ clip_id: string; editing_guide: EditingGuide }> => {
  const { data } = await api.post(`/clips/${clipId}/editing-guide`, null, {
    timeout: 45000,
  });
  return data;
};

export default api;
