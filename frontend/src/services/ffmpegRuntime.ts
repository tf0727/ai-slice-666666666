import { FFmpeg } from '@ffmpeg/ffmpeg';
import bundledCoreScriptUrl from '@ffmpeg/core?url';
import bundledCoreWasmUrl from '@ffmpeg/core/wasm?url';

interface FFmpegLoadOptions {
  signal?: AbortSignal;
}

interface FFmpegCoreUrls {
  coreURL: string;
  wasmURL: string;
}

interface SharedFFmpegLike {
  load(urls: FFmpegCoreUrls, options?: FFmpegLoadOptions): Promise<unknown>;
  terminate(): void;
}

interface DirectoryFFmpegLike {
  createDir(path: string): Promise<unknown>;
}

interface WorkerFsFFmpegLike extends DirectoryFFmpegLike {
  mount(type: string, options: { files: File[] }, path: string): Promise<unknown>;
}

interface CleanupFFmpegLike {
  unmount(path: string): Promise<unknown>;
  deleteDir(path: string): Promise<unknown>;
  deleteFile(path: string): Promise<unknown>;
}

interface SharedFFmpegRuntimeOptions<T extends SharedFFmpegLike> {
  createFFmpeg?: () => T;
  resolveCoreUrls?: () => Promise<FFmpegCoreUrls>;
}

interface GetSharedFFmpegOptions {
  onLoadProgress?: (message: string) => void;
  loadingMessage?: string;
  readyMessage?: string | null;
  signal?: AbortSignal;
}

const FALLBACK_CORE_SCRIPT_URL = '/ffmpeg/ffmpeg-core.js';
const FALLBACK_CORE_WASM_URL = '/ffmpeg/ffmpeg-core.wasm';

interface FFmpegCoreCandidate {
  label: string;
  scriptUrl: string;
  wasmUrl: string;
}

const ffmpegCoreCandidates: FFmpegCoreCandidate[] = [
  {
    label: 'bundled @ffmpeg/core asset',
    scriptUrl: bundledCoreScriptUrl,
    wasmUrl: bundledCoreWasmUrl,
  },
  {
    label: 'public ffmpeg fallback',
    scriptUrl: FALLBACK_CORE_SCRIPT_URL,
    wasmUrl: FALLBACK_CORE_WASM_URL,
  },
];

async function createBlobUrlWithValidation(
  assetUrl: string,
  mimeType: string,
): Promise<string> {
  const response = await fetch(assetUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} when loading ${assetUrl}`);
  }

  if (mimeType === 'text/javascript') {
    const scriptSource = await response.text();
    if (scriptSource.trimStart().startsWith('<')) {
      throw new Error(`Expected JavaScript but received HTML from ${assetUrl}`);
    }
    return URL.createObjectURL(new Blob([scriptSource], { type: mimeType }));
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const sniffedText = new TextDecoder().decode(bytes.slice(0, 32)).trimStart();
  if (sniffedText.startsWith('<')) {
    throw new Error(`Expected WebAssembly binary but received HTML from ${assetUrl}`);
  }

  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

async function resolveDefaultCoreUrls(): Promise<FFmpegCoreUrls> {
  let lastError: unknown;

  for (const candidate of ffmpegCoreCandidates) {
    try {
      const coreURL = await createBlobUrlWithValidation(candidate.scriptUrl, 'text/javascript');
      const wasmURL = await createBlobUrlWithValidation(candidate.wasmUrl, 'application/wasm');
      return { coreURL, wasmURL };
    } catch (error) {
      lastError = error;
      console.warn(`[FFmpegRuntime] Failed to load ${candidate.label}.`, error);
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown error');
  throw new Error(
    `Unable to load FFmpeg core assets. Tried bundled assets and /ffmpeg fallback. ${reason}`,
  );
}

export function createAbortError(): DOMException {
  return new DOMException('本地处理已取消', 'AbortError');
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

export function watchAbort(signal: AbortSignal | undefined, onAbort: () => void): () => void {
  if (!signal) return () => {};

  const handler = () => onAbort();
  signal.addEventListener('abort', handler, { once: true });
  return () => signal.removeEventListener('abort', handler);
}

export async function ensureDir(ffmpeg: DirectoryFFmpegLike, path: string) {
  try {
    await ffmpeg.createDir(path);
  } catch {
    // Directory may already exist in a reused instance.
  }
}

export async function mountWorkerFile(
  ffmpeg: WorkerFsFFmpegLike,
  file: File,
  mountPoint: string,
): Promise<string> {
  await ensureDir(ffmpeg, mountPoint);
  await ffmpeg.mount('WORKERFS', { files: [file] }, mountPoint);
  return `${mountPoint}/${file.name}`;
}

export async function cleanupFfmpegPaths(
  ffmpeg: CleanupFFmpegLike,
  {
    mounts = [],
    directories = [],
    files = [],
  }: {
    mounts?: string[];
    directories?: string[];
    files?: string[];
  },
) {
  for (const mountPath of mounts) {
    try {
      await ffmpeg.unmount(mountPath);
    } catch {
      // Ignore cleanup errors after abort/terminate.
    }
  }

  for (const filePath of files) {
    try {
      await ffmpeg.deleteFile(filePath);
    } catch {
      // Ignore cleanup errors after partial execution.
    }
  }

  for (const directoryPath of directories) {
    try {
      await ffmpeg.deleteDir(directoryPath);
    } catch {
      // Ignore cleanup errors after abort/terminate.
    }
  }
}

export function createSharedFFmpegRuntime<T extends SharedFFmpegLike = FFmpeg>({
  createFFmpeg = () => new FFmpeg() as unknown as T,
  resolveCoreUrls = resolveDefaultCoreUrls,
}: SharedFFmpegRuntimeOptions<T> = {}) {
  let ffmpeg: T | null = null;
  let loadPromise: Promise<T> | null = null;

  const reset = () => {
    ffmpeg = null;
    loadPromise = null;
  };

  const getFFmpeg = async ({
    onLoadProgress,
    loadingMessage = '正在加载 FFmpeg 引擎...',
    readyMessage = 'FFmpeg 引擎就绪',
    signal,
  }: GetSharedFFmpegOptions = {}): Promise<T> => {
    if (ffmpeg && loadPromise) {
      return loadPromise;
    }

    const instance = createFFmpeg();
    ffmpeg = instance;

    loadPromise = (async () => {
      onLoadProgress?.(loadingMessage);

      const stopWatchingAbort = watchAbort(signal, () => {
        instance.terminate();
        reset();
      });

      try {
        throwIfAborted(signal);
        const urls = await resolveCoreUrls();
        await instance.load(urls, signal ? { signal } : undefined);
        if (readyMessage) {
          onLoadProgress?.(readyMessage);
        }
        return instance;
      } catch (error) {
        reset();
        throw error;
      } finally {
        stopWatchingAbort();
      }
    })();

    return loadPromise;
  };

  return {
    getFFmpeg,
    reset,
  };
}
