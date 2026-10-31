# AI Slice · 阿里云转录版

上传视频，在浏览器中提取音频，通过阿里云 Paraformer 生成带时间戳的转录，
由 DeepSeek 分析精彩片段，再使用浏览器端 FFmpeg 导出视频切片。

本仓库基于用户提供的 AI Slice 课程 demo 整理，保留原项目相关署名与代码注释。
当前版本专注阿里云语音识别与 DeepSeek 内容分析。

## 功能

- 视频上传前在浏览器提取 16 kHz 单声道 MP3，减少上传体积。
- 阿里云百炼 Paraformer 流式识别，保留句级时间戳。
- DeepSeek 提取精彩片段、生成标题文案和剪辑建议。
- 任务进度、历史任务、失败重试和删除。
- 浏览器端选择原视频，按推荐时间段裁切并打包下载。

## 技术栈

React 19 / TypeScript / Vite 8 / Tailwind CSS / FFmpeg.wasm；
Python / FastAPI / SQLAlchemy / PostgreSQL / Alembic。

## 本地运行

准备 Node.js 22.12+（本项目在 Node.js 24 验证）、Python 3.12、uv，
以及 PostgreSQL 16（可通过 Docker Compose 启动）。

### 1. 数据库

```sh
docker compose up -d
```

默认连接本机 5432 端口，数据库 `ai_slice`，本地开发账号为 `slice` / `slice_dev`。
也可自行安装 PostgreSQL，并在配置文件中修改连接地址。

### 2. 后端配置

复制 `backend/.env.example` 为 `backend/.env`，填写：

```dotenv
DASHSCOPE_API_KEY=你的阿里云百炼密钥
DEEPSEEK_API_KEY=你的DeepSeek密钥
```

两项密钥来自不同平台，不可混用。默认阿里云模型为 `paraformer-realtime-v2`，
默认使用北京地域 DashScope 地址。使用业务空间专属地址时，按控制台信息修改
`DASHSCOPE_ASR_URL`，并确认模型、密钥与地域匹配。

```sh
cd backend
uv sync
uv run alembic upgrade head
uv run python -m dotenv -f .env run --override -- python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

命令显式加载项目 `.env`，避免本机同名旧环境变量覆盖密钥。修改配置后需要重启后端。

### 3. 前端

在另一个终端运行：

```sh
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

- 页面：<http://127.0.0.1:5173>
- API 文档：<http://127.0.0.1:8001/docs>
- 健康检查：<http://127.0.0.1:8001/api/health>

Vite 将 `/api` 转发到后端 8001 端口，并设置 FFmpeg.wasm 需要的跨源隔离响应头。

Windows 用户在完成上述依赖安装、数据库迁移和配置后，也可运行
`start_windows.bat` / `stop_windows.bat` 启停前后端。脚本要求 PostgreSQL 已运行。

## 使用

1. 打开“新建切片”，选择本地视频并创建任务。
2. 等待浏览器音频提取、云端转录及内容分析。
3. 在详情页查看片段时间点、标题和剪辑思路。
4. 点击“一键切片”，选择原视频后导出。

直接上传音频时，应使用单声道 MP3 或 PCM WAV，并配置与文件一致的采样率。
浏览器抽取的视频音频默认满足 16 kHz 单声道要求。
本项目是本地 demo，没有用户登录和租户隔离，不提供开箱即用的公网部署配置。

## 验证

```sh
cd backend
uv run python -m unittest discover -s tests
```

```sh
cd frontend
npm run build
```

## 仓库范围

包含应用源码、数据库迁移、测试、依赖锁文件、配置模板和启动脚本。
不包含个人 API 密钥、数据库备份、上传素材、运行日志、虚拟环境、node_modules、
便携数据库或本地下载工具。课程讲义与历史方案未纳入此精简版本。
