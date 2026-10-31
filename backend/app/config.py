from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """应用配置，从环境变量或 .env 文件加载"""

    # Database
    database_url: str = "postgresql+asyncpg://slice:slice_dev@localhost:5432/ai_slice"

    # DeepSeek
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"

    # Alibaba Cloud DashScope Paraformer
    asr_provider: str = "aliyun"
    dashscope_api_key: str = ""
    dashscope_asr_model: str = "paraformer-realtime-v2"
    dashscope_asr_url: str = "wss://dashscope.aliyuncs.com/api-ws/v1/inference"
    dashscope_asr_sample_rate: int = 16000

    # 本地文件存储
    storage_dir: str = "./storage"

    # Pipeline
    temp_dir: str = "/tmp/ai-slice"

    # 服务端 FFmpeg 路径（可选，仅历史任务的时长补救需要）
    # 纯前端 FFmpeg 架构下，服务端不再切视频，留空即可
    ffmpeg_bin_dir: str = ""

    # Worker 后台协程池大小：同一时刻最多并行处理的任务数
    # 纯前端 FFmpeg 架构下服务端只做 ASR + LLM（纯网络 I/O），无 CPU 抢核
    # 真正瓶颈是 阿里云 / DeepSeek 的 RPM 限制，可放心调高
    worker_concurrency: int = 10

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
