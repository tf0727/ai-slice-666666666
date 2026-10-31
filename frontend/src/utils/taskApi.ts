import type { TaskDetail } from '../types/task';

type TaskDetailRequiredFields = Pick<
  TaskDetail,
  'id' | 'status' | 'video_filename' | 'progress' | 'progress_message' | 'created_at' | 'updated_at'
>;

type TaskDetailOptionalFields = Partial<
  Pick<TaskDetail, 'scene_mode' | 'video_oss_key' | 'video_duration' | 'video_start_offset' | 'error_message' | 'clips'>
>;

export type TaskDetailResponseInput = TaskDetailRequiredFields & TaskDetailOptionalFields;

export function normalizeTaskDetailResponse(task: TaskDetailResponseInput): TaskDetail {
  return {
    ...task,
    scene_mode: task.scene_mode ?? 'livestream',
    video_oss_key: task.video_oss_key ?? '',
    video_duration: task.video_duration ?? null,
    video_start_offset: task.video_start_offset ?? 0,
    error_message: task.error_message ?? null,
    clips: task.clips ?? [],
  };
}
