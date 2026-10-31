import { FFmpeg } from '@ffmpeg/ffmpeg';
import { zipSync } from 'fflate';

import {
  buildLocalClipSpecs,
  type LocalClipExportFailure,
} from '../utils/localClipExport';
import {
  cleanupFfmpegPaths,
  createAbortError,
  createSharedFFmpegRuntime,
  ensureDir,
  mountWorkerFile,
  throwIfAborted,
  watchAbort,
} from './ffmpegRuntime';

export interface LocalClipExportProgress {
  stage: 'loading' | 'reading' | 'clipping' | 'zipping' | 'done';
  currentClip: number;
  totalClips: number;
  message: string;
}

interface ExportVideoClipsLocallyOptions {
  videoFile: File;
  clips: Array<{
    clip_index: number;
    title: string;
    start_time: number;
    end_time: number;
  }>;
  videoStartOffset?: number;
  onProgress?: (progress: LocalClipExportProgress) => void;
  signal?: AbortSignal;
}

interface LocalClipExportResult {
  blob: Blob;
  succeeded: number;
  failed: LocalClipExportFailure[];
}

const clipExporterRuntime = createSharedFFmpegRuntime<FFmpeg>();

export async function exportVideoClipsLocally({
  videoFile,
  clips,
  videoStartOffset = 0,
  onProgress,
  signal,
}: ExportVideoClipsLocallyOptions): Promise<LocalClipExportResult> {
  const ffmpeg = await clipExporterRuntime.getFFmpeg({
    onLoadProgress: (message) => {
      onProgress?.({
        stage: 'loading',
        currentClip: 0,
        totalClips: 0,
        message,
      });
    },
    loadingMessage: '正在加载本地切片引擎',
    readyMessage: null,
    signal,
  });
  const clipSpecs = buildLocalClipSpecs(clips, videoStartOffset);
  const failed: LocalClipExportFailure[] = [];
  const archiveEntries: Record<string, Uint8Array> = {};
  const inputDir = '/input';
  const outputDir = '/output';
  let aborted = false;

  const stopWatchingAbort = watchAbort(signal, () => {
    aborted = true;
    ffmpeg.terminate();
    clipExporterRuntime.reset();
  });

  try {
    throwIfAborted(signal);

    onProgress?.({
      stage: 'reading',
      currentClip: 0,
      totalClips: clipSpecs.length,
      message: '正在读取视频文件',
    });

    await ensureDir(ffmpeg, inputDir);
    await ensureDir(ffmpeg, outputDir);
    const inputPath = await mountWorkerFile(ffmpeg, videoFile, inputDir);

    for (const [index, clip] of clipSpecs.entries()) {
      throwIfAborted(signal);

      onProgress?.({
        stage: 'clipping',
        currentClip: index + 1,
        totalClips: clipSpecs.length,
        message: `正在切片 ${index + 1} / ${clipSpecs.length}`,
      });

      const outputPath = `${outputDir}/${clip.outputName}`;

      try {
        const exitCode = await ffmpeg.exec(
          [
            '-ss',
            clip.startTime.toFixed(3),
            '-i',
            inputPath,
            '-t',
            clip.duration.toFixed(3),
            '-c',
            'copy',
            '-avoid_negative_ts',
            'make_zero',
            '-y',
            outputPath,
          ],
          -1,
          { signal },
        );

        if (exitCode !== 0) {
          throw new Error(`ffmpeg exit code ${exitCode}`);
        }

        const fileData = await ffmpeg.readFile(outputPath, 'binary', { signal });
        archiveEntries[clip.outputName] = new Uint8Array(fileData as Uint8Array);
        await ffmpeg.deleteFile(outputPath);
      } catch (error) {
        if (signal?.aborted) {
          throw createAbortError();
        }

        failed.push({
          clipIndex: clip.clipIndex,
          title: clip.title,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (Object.keys(archiveEntries).length === 0) {
      throw new Error('所有片段导出失败，未生成可下载文件');
    }

    onProgress?.({
      stage: 'zipping',
      currentClip: clipSpecs.length,
      totalClips: clipSpecs.length,
      message: '正在打包 ZIP',
    });

    const zipBytes = zipSync(archiveEntries);
    const zipBuffer = new Uint8Array(zipBytes);
    const result = {
      blob: new Blob([zipBuffer.buffer], { type: 'application/zip' }),
      succeeded: Object.keys(archiveEntries).length,
      failed,
    };

    onProgress?.({
      stage: 'done',
      currentClip: clipSpecs.length,
      totalClips: clipSpecs.length,
      message: '准备下载',
    });

    return result;
  } catch (error) {
    if (aborted || signal?.aborted) {
      throw createAbortError();
    }
    throw error;
  } finally {
    stopWatchingAbort();

    await cleanupFfmpegPaths(ffmpeg, {
      mounts: [inputDir],
      directories: [outputDir, inputDir],
    });

    if (aborted || signal?.aborted) {
      clipExporterRuntime.reset();
    }
  }
}
